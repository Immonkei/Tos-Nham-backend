const abaService = require("../services/abaService");
const { Payment, Order } = require("../models");

class AbaController {
  async createPayment(req, res) {
    try {
      const order = {
        total_amount: req.body.total_amount || "10.00",
        orderItems: req.body.orderItems || [
          { name: "Generic Item", quantity: 1, price: "10.00" },
        ],
        delivery_name: req.body.delivery_name || "Test User",
        delivery_phone: req.body.delivery_phone || "012345678",
        delivery_email: req.body.delivery_email || "test@example.com",
      };

      const paymentForm = abaService.generateABAPaymentForm(order);
      
      // CRITICAL: This log is needed to see the exact fields being sent to ABA
      console.log("ABA Payment Form Fields being sent:", JSON.stringify(paymentForm.fields, null, 2));

      res.json({
        success: true,
        message: "ABA payment form generated successfully.",
        data: paymentForm,
      });
    } catch (error) {
      console.error("Error in AbaController.createPayment:", error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async abaCallback(req, res) {
    try {
      const { tran_id } = req.body;
      if (!tran_id) {
        return res.status(400).send("Bad Request: Missing transaction ID.");
      }
      const paymentRecord = await Payment.findOne({
        where: { transaction_ref: tran_id },
      });
      if (!paymentRecord) {
        return res.status(404).send("Payment not found in our system.");
      }
      const abaStatusResponse = await abaService.checkTransactionStatus(tran_id);
      if (!abaStatusResponse || abaStatusResponse.status.code !== "00") {
        await paymentRecord.update({ status: "Failed_ABA_Check" });
        return res.status(500).send("Failed to verify transaction with ABA.");
      }
      const transactionStatus = abaStatusResponse.status.code;
      const pwTranId = abaStatusResponse.pw_tran_id;
      if (transactionStatus === "00") {
        await paymentRecord.update({
          status: "Verified",
          pw_tran_id: pwTranId,
        });
        await Order.update(
          {
            payment_status: "Paid",
            order_status: "Confirmed",
          },
          { where: { id: paymentRecord.order_id } }
        );
        return res.status(200).send("OK");
      } else {
        await paymentRecord.update({
          status: "Rejected",
          pw_tran_id: pwTranId,
        });
        return res.status(200).send("OK");
      }
    } catch (error) {
      console.error("ABA Callback Error:", error);
      return res.status(500).send("Error processing callback.");
    }
  }
}

module.exports = new AbaController();
