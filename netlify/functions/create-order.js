const Razorpay = require("razorpay");
const { Client } = require("pg");

// Initialize Razorpay with env variables
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
    const { name, college, year, email, phone, event: event_type, pronouns, gender } = body;

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: 10 * 100, // ₹10 in paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });

    // Connect to DB
    await client.connect();

    // Insert user data with Razorpay order ID
    const query = `
      INSERT INTO registrations
      (name, college, year, email, phone, event_type, pronouns, razorpay_order_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id
    `;
    const values = [name, college, year || null, email, phone || null, event_type || null, pronouns || null, order.id];

    const res = await client.query(query, values);
    await client.end();

    // Return order info to frontend
    return {
      statusCode: 200,
      body: JSON.stringify({
        key: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      }),
    };
  } catch (error) {
    console.error("Error in create-order:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Order creation failed" }),
    };
  }
};
