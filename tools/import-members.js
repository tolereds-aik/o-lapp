const admin = require("firebase-admin");
const { google } = require("googleapis");
require("dotenv").config();

const CREDENTIALS = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const client = google.auth.fromJSON(CREDENTIALS);
client.scopes = ["https://www.googleapis.com/auth/drive"];

const drive = google.drive({ version: "v3", auth: client });

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://olapp-6c8ab.firebaseio.com",
});

const stats = { nMembers: 0, nGroups: 0 };
const database = admin.database();

const blacklistedNames = ["Robert Jerkstrand", "Eive Jerkstrand"];

findSettingsFolderId()
  .then((folderId) => listSpreadsheets(folderId))
  .then((files) => files.find((f) => f.name === "TAIK Grupplista"))
  .then(({ id }) => {
    drive.files
      .export({ fileId: id, mimeType: "text/csv" }, { responseType: "json" })
      .then(({ data }) => {
        const lines = data.split("\n").slice(1);
        const membersRef = database.ref("/members");

        membersRef.once("value", (membersSnapshot) => {
          const members = membersSnapshot.val() || {};

          const groupsRef = database.ref("/groups");
          groupsRef.once("value", (snapshot) => {
            const groupNameMap = {};
            const groupMembers = {};
            const groups = snapshot.val() || {};
            for (let id in groups) {
              const group = groups[id];
              groupNameMap[group.name] = groupsRef.child(id);
            }

            lines.forEach((line) => {
              const cols = line.split(",");
              const isGuardian = cols[1].trim();
              if (!isGuardian) {
                const id = cols[4];
                const groupName = cols[0];

                let groupRef = groupNameMap[groupName];
                if (!groupRef) {
                  groupRef = groupNameMap[groupName] = groupsRef.push();
                }
                if (!groupMembers[groupRef.key]) {
                  stats.nGroups++;
                  groupMembers[groupRef.key] = groups[groupRef.key]
                    ? { ...groups[groupRef.key], members: {} }
                    : { name: groupName, members: {} };
                }

                const memberGroups = (members[id] && members[id].groups) || {};
                memberGroups[groupRef.key] = true;

                const memberProps = colsToMember(cols);
                if (blacklistedNames.includes(memberProps.name)) {
                  console.log(
                    `Blacklisted member: ${memberProps.name} for ${groupName}`,
                  );
                  delete members[id];
                  membersRef.child(id).remove(awaitCb());
                  return;
                }

                groupMembers[groupRef.key].members[id] = true;

                members[id] = {
                  ...members[id],
                  ...memberProps,
                  guardians: {},
                  groups: memberGroups,
                };

                membersRef.child(id).set(members[id], awaitCb());
                stats.nMembers++;
              } else {
                const pattern = /Till målsman för:\s*(.*)/;
                const childNameWithPossibleAlias = pattern
                  .exec(cols[1])[1]
                  .trim();
                const childName = childNameWithPossibleAlias?.replace(
                  / ".*"/g,
                  "",
                );
                const childId = Object.keys(members).find(
                  (id) => members[id].name === childName,
                );
                if (!childId) {
                  console.error(
                    `Unable to find child with name ${childName} (${childNameWithPossibleAlias}) for guardian ${cols[2]} ${cols[3]}`,
                  );
                } else {
                  const child = members[childId];
                  let gs = child.guardians;
                  if (!gs) {
                    gs = child.guardians = {};
                  }
                  gs[cols[4]] = colsToMember(cols);
                  membersRef.child(childId).set(child, awaitCb());
                }
              }
            });

            groupsRef.set(groupMembers, awaitCb());
          });
        });
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });

    let waitCount = 0;
    function awaitCb() {
      waitCount++;

      return (err) => {
        if (err) {
          console.error(err);
          process.exit(1);
        }

        if (--waitCount <= 0) {
          console.log(
            `Successfully imported ${stats.nMembers} members in ${stats.nGroups} groups.`,
          );
          process.exit(0);
        }
      };
    }

    function colsToMember(cols) {
      const phone = cols[6].startsWith("46")
        ? "+" + cols[6]
        : cols[6].startsWith("0")
          ? cols[6]
          : "0" + cols[6];

      return {
        name: [cols[2], cols[3]].join(" "),
        phone,
        email: cols[7],
        birthdate: cols[5],
      };
    }
  });

async function query(params) {
  return await drive.files.list(params);
}

async function findSettingsFolderId() {
  const {
    data: {
      files: [{ id }],
    },
  } = await query({
    q: 'name="Inställningar" and mimeType="application/vnd.google-apps.folder"',
  });

  return id;
}

async function listSpreadsheets(folderId) {
  return (
    await query({
      q: `"${folderId}" in parents and mimeType = "application/vnd.google-apps.spreadsheet"`,
    })
  ).data.files;
}
