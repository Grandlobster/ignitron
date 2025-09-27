const Razorpay = require("razorpay");
const { Pool } = require("pg");
const crypto = require("crypto");

// PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

exports.handler = async (event, context) => {
  let client;
  try {
    const body = JSON.parse(event.body);
    const {
      name,
      college,
      year,
      email,
      phone,
      event_type,
      gender,
      pronouns,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    // 1️⃣ Verify Razorpay signature
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

    // 2️⃣ Connect to DB
    client = await pool.connect();

    // 3️⃣ Update registration with payment_id
    const updateQuery = `
      UPDATE registrations
      SET razorpay_payment_id=$1
      WHERE razorpay_order_id=$2
      RETURNING id
    `;
    const values = [razorpay_payment_id, razorpay_order_id];
    const result = await client.query(updateQuery, values);

    client.release();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, registrationId: result.rows[0].id }),
    };
  } catch (error) {
    if (client) client.release();
    console.error("Error in verify-payment:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: "Payment verification failed" }),
    };
  }
};
