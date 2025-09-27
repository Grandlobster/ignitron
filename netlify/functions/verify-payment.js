const Razorpay = require("razorpay");
const { Client } = require("pg");
const crypto = require("crypto");

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// PostgreSQL client
const client = new Client({
  connectionString: process.env.NETLIFY_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

exports.handler = async (event, context) => {
  try {
    const body = JSON.parse(event.body);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    // Verify payment signature
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: "Invalid signature" }),
      };
    }

    // Connect to DB
    await client.connect();

    // Update registration (optional: mark as paid)
    const updateQuery = `
      UPDATE registrations
      SET razorpay_payment_id = $1
      WHERE razorpay_order_id = $2
    `;
    await client.query(updateQuery, [razorpay_payment_id, razorpay_order_id]);
    await client.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("Error in verify-payment:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: "Payment verification failed" }),
    };
  }
};
