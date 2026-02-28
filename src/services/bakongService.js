const axios = require("axios");

const PYTHON_SERVICE_URL = "http://localhost:8001";

async function generateKHQR(order) {
  const response = await axios.post(`${PYTHON_SERVICE_URL}/generate`, {
    bank_account: "ly_hour3@bkrt",
    merchant_name: "HOUR LY",
    merchant_city: "Phnom Penh",
    amount: order.total_amount,
    currency: "KHR",
    bill_number: order.id.toString(),
  });

  return response.data; // { qr, md5 }
}

async function checkPayment(md5) {
  const response = await axios.get(
    `${PYTHON_SERVICE_URL}/check/${md5}`
  );

  return response.data;
}

module.exports = {
  generateKHQR,
  checkPayment,
};