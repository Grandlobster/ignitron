// functions/create-order.js
const Razorpay = require("razorpay");
const { Client } = require("pg"); // Neon/Postgres client

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body);

    // 1️⃣ Connect to Neon/Postgres
    const client = new Client({
      connectionString: process.env.NETLIFY_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    // 2️⃣ Create table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        college TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        year INT,
        event_type TEXT,
        pronouns TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3️⃣ Insert user registration
    const insertQuery = `
      INSERT INTO registrations (name, college, phone, email, year, event_type, pronouns)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id
    `;
    const values = [
      data.name,
      data.college,
      data.phone,
      data.email,
      data.year,
      data.eventType,
      data.pronouns,
    ];
    const result = await client.query(insertQuery, values);
    const registrationId = result.rows[0].id;

    await client.end();

    // 4️⃣ Create Razorpay order
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: 1000, // ₹10 in paise
      currency: "INR",
      receipt: `reg_${registrationId}`,
      payment_capture: 1,
    });

    // 5️⃣ Return order info to frontend
    return {
      statusCode: 200,
      body: JSON.stringify({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        registrationId: registrationId,
      }),
    };

  } catch (err) {
    console.error("Error in create-order:", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
