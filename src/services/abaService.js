const crypto = require("crypto");
const axios = require("axios"); // Make sure axios is installed: npm install axios

class AbaService {
  constructor() {
    if (!process.env.ABA_PUBLIC_KEY || !process.env.ABA_MERCHANT_ID) {
      console.error("ABA_PUBLIC_KEY and ABA_MERCHANT_ID must be set in environment variables.");
    }
  }

  generateABAPaymentForm(order) {
    // IMPORTANT: Use the actual PUBLIC KEY for hashing, not the API Key
    const publicKey = process.env.ABA_PUBLIC_KEY; 
    const merchantId = process.env.ABA_MERCHANT_ID;

    if (!publicKey || !merchantId) {
      throw new Error("ABA_PUBLIC_KEY and ABA_MERCHANT_ID are not configured.");
    }

    const reqTime = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);

    const timestampPart = Date.now().toString().slice(-10);
    const randomPart = Math.random().toString(36).substring(2, 7);
    const transactionId = `ORD-${timestampPart}-${randomPart}`.substring(0, 20);

    const itemsObject = [
      {
        name: "Food Order",
        quantity: String(order.orderItems?.length || 1),
        price: parseFloat(order.total_amount).toFixed(2),
      },
    ];
    const itemsBase64 = Buffer.from(JSON.stringify(itemsObject)).toString("base64");

    const returnUrlValue = process.env.ABA_RETURN_URL || "";
    const cancelUrlValue = process.env.ABA_CANCEL_URL || "";
    const continueSuccessUrlValue = process.env.ABA_CONTINUE_SUCCESS_URL || process.env.ABA_RETURN_URL || "";

    // Ensure URLs are Base64 encoded for the hash string if they are sent as Base64 in the form
    const returnUrlBase64 = Buffer.from(returnUrlValue).toString("base64");
    const cancelUrlBase64 = Buffer.from(cancelUrlValue).toString("base64");

    const customFieldsValue = order.custom_fields ? Buffer.from(JSON.stringify(order.custom_fields)).toString("base64") : "";

    // --- NEW PARAMETERS (24 TOTAL) ---
    const payout = "";
    const lifetime = "";
    const additional_params = "";
    const google_pay_token = "";
    const skip_success_page = "";

    const params = {
      req_time: reqTime,
      merchant_id: merchantId,
      tran_id: transactionId,
      amount: parseFloat(order.total_amount).toFixed(2),
      items: itemsBase64,
      shipping: "0",
      firstname: order.delivery_name || "",
      lastname: "",
      email: order.delivery_email || "",
      phone: order.delivery_phone || "",
      type: "purchase",
      payment_option: "abapay",
      return_url: returnUrlBase64,
      cancel_url: cancelUrlBase64,
      continue_success_url: continueSuccessUrlValue,
      return_deeplink: "",
      currency: "USD",
      custom_fields: customFieldsValue,
      return_params: "",
      payout: payout,
      lifetime: lifetime,
      additional_params: additional_params,
      google_pay_token: google_pay_token,
      skip_success_page: skip_success_page
    };

    // Updated parameter order based on latest ABA documentation (24 parameters)
    const paramOrder = [
      "req_time", "merchant_id", "tran_id", "amount", "items", "shipping",
      "firstname", "lastname", "email", "phone", "type", "payment_option",
      "return_url", "cancel_url", "continue_success_url", "return_deeplink",
      "currency", "custom_fields", "return_params", "payout", "lifetime",
      "additional_params", "google_pay_token", "skip_success_page"
    ];

    // Construct the hash string by concatenating values in the specified order
    const hashString = paramOrder.map((key) => String(params[key] || "")).join("");

    // Generate HMAC-SHA512 hash using the PUBLIC KEY
    const hash = crypto
      .createHmac("sha512", publicKey)
      .update(hashString)
      .digest("base64");

    return {
      action: process.env.ABA_SANDBOX_API_URL, 
      transactionId,
      fields: {
        ...params,
        hash,
      },
    };
  }

  async checkTransactionStatus(transactionId) {
    const publicKey = process.env.ABA_PUBLIC_KEY;
    const merchantId = process.env.ABA_MERCHANT_ID;
    const checkTransactionUrl = process.env.ABA_SANDBOX_CHECK_TRANSACTION_URL || "https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/check-transaction";

    if (!publicKey || !merchantId) {
      throw new Error("ABA_PUBLIC_KEY and ABA_MERCHANT_ID are not configured for transaction check.");
    }

    const reqTime = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

    // Hash for check transaction API is different: req_time + merchant_id + tran_id
    const hashString = `${reqTime}${merchantId}${transactionId}`;
    const hash = crypto.createHmac("sha512", publicKey)
                       .update(hashString)
                       .digest("base64");

    const formData = new URLSearchParams();
    formData.append("req_time", reqTime);
    formData.append("merchant_id", merchantId);
    formData.append("tran_id", transactionId);
    formData.append("hash", hash);

    try {
      const response = await axios.post(checkTransactionUrl, formData.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      return response.data;
    } catch (error) {
      console.error("Error checking ABA transaction status:", error.response ? error.response.data : error.message);
      throw new Error("Failed to check transaction status with ABA.");
    }
  }
}

module.exports = new AbaService();
