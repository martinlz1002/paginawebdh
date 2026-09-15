const fs = require("fs");

const env = fs.readFileSync(".env.local", "utf8");

const match = env.match(
  /^FIREBASE_SERVICE_ACCOUNT_KEY_B64=(.+)$/m
);

if (!match) {
  console.log("NO SE ENCONTRO FIREBASE_SERVICE_ACCOUNT_KEY_B64");
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(
    Buffer.from(match[1].trim(), "base64").toString("utf8")
  );

  console.log({
    type: serviceAccount.type,
    project_id: serviceAccount.project_id,
    client_email: serviceAccount.client_email,
    hasPrivateKey: !!serviceAccount.private_key,
  });
} catch (error) {
  console.error("ERROR DECODIFICANDO LA CREDENCIAL:");
  console.error(error.message);
}