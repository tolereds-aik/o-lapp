const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();

exports.addUserToDatabase = functions.auth.user().onCreate((user) => {
  return admin
    .database()
    .ref("users/" + user.uid)
    .set({
      email: user.email,
      name: user.displayName,
      createdAt: new Date().toISOString(),
      groups: {},
    });
});
