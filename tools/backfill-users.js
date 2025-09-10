const admin = require("firebase-admin");
require("dotenv").config();

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://olapp-6c8ab.firebaseio.com",
});

const auth = admin.auth();
const db = admin.database();

async function backfillUsers() {
  let nextPageToken;
  let totalCount = 0;

  try {
    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);

      // Sequential updates (safe but a little slower)
      for (const userRecord of listUsersResult.users) {
        const uid = userRecord.uid;

        const userData = {
          email: userRecord.email || null,
          displayName: userRecord.displayName || null,
          createdAt: userRecord.metadata.creationTime,
          lastLoginAt: userRecord.metadata.lastSignInTime,
        };

        await db.ref(`users/${uid}`).update(userData);
        // console.log(userData);
      }

      totalCount += listUsersResult.users.length;
      console.log(`✅ Processed ${listUsersResult.users.length} users...`);

      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    console.log(`🎉 Backfill complete! Total users processed: ${totalCount}`);
  } catch (err) {
    console.error("❌ Error backfilling users:", err);
  }
}

backfillUsers();
