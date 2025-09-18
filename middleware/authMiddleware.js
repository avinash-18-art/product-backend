const jwt = require("jsonwebtoken");
const secretKey = "apjabdulkalam@545";

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.json({ message: "Token required" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, secretKey, (err, decode) => {
    if (err) return res.json({ message: "Invalid token" });
    req.user = decode;
    next();
  });
}

module.exports = verifyToken;
