const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// Tell Express to serve everything inside the "public" folder
app.use(express.static(path.join(__dirname, "public")));

// Start the server
app.listen(PORT, () => {
    console.log(`GymPact is running at http://localhost:${PORT}`);
});