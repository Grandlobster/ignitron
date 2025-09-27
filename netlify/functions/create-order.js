const Razorpay = require("razorpay");
const { Pool } = require("pg");

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

exports.handler = async (event, context) => {
  let client;
  try {
    const body = JSON.parse(event.body);
    const { name, college, year, email, phone, event_type, gender, pronouns, amount } = body;

    // 1️⃣ Create Razorpay order
    const options = {
      amount: amount * 100, // amount in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1,
    };
    const order = await razorpay.orders.create(options);

    // 2️⃣ Insert a registration placeholder (optional, can insert after payment)
    client = await pool.connect();
    const insertQuery = `
      INSERT INTO registrations (name, college, year, email, phone, event_type, gender, pronouns, razorpay_order_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id
    `;
    const values = [name, college, year, email, phone, event_type, gender, pronouns, order.id];
    const result = await client.query(insertQuery, values);
    client.release();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        key: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        registrationId: result.rows[0].id,
      }),
    };
  } catch (error) {
    if (client) client.release();
    console.error("Error in create-order:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: "Order creation failed" }),
    };
  }
};
