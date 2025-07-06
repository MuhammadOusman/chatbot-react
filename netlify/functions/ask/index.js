const Groq = require("groq-sdk");

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' }),
        };
    }

    try {
        const groq = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });

        const { message } = JSON.parse(event.body);

        if (!message) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Missing message in request body' }),
            };
        }

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a helpful and concise AI assistant. Answer the user's questions directly and politely. If you don't know the answer, state that you cannot help with that query."
                },
                {
                    role: "user",
                    content: message,
                },
            ],
            model: "llama3-8b-8192",
            temperature: 0.7,
            max_tokens: 150,
            stream: false,
        });

        const botReply = chatCompletion.choices[0]?.message?.content || "Sorry, I couldn't get a response.";

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ reply: botReply }),
        };

    } catch (error) {
        console.error('Groq API Error:', error);
        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
        };
    }
};
