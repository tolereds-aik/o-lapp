import { useContext } from "react";
import { Link } from "react-router-dom";
import Breadcrumbs from "./breadcrumbs";
import Query from "./Query";
import { store } from "./store";
import compare from "trivial-compare";

export function Admin() {
  return (
    <Query path={`/users`}>
      {(usersMap) => {
        const users = Object.keys(usersMap).map((userId) => ({
          ...usersMap[userId],
          id: userId,
          displayName:
            usersMap[userId].displayName || usersMap[userId].email || userId,
        }));
        users.sort((a, b) => compare(a.displayName, b.displayName));
        return (
          <div className="box-group">
            {users.map((user) => {
              return (
                <div key={user.id} className="box">
                  <article>
                    <Link to={`/admin/users/${user.id}`}>
                      <h2>{user.displayName}</h2>
                    </Link>
                  </article>
                </div>
              );
            })}
          </div>
        );
      }}
    </Query>
  );
}

export function AdminUser({
  match: {
    params: { userId },
  },
}) {
  const {
    state: { database },
  } = useContext(store);

  return (
    <>
      <div className="heading">
        <Breadcrumbs
          crumbs={[
            ["/admin", "Admin"],
            [`/admin/${userId}`, userId],
          ]}
        >
          o-Lapp
        </Breadcrumbs>
      </div>
      <div className="content">
        <Query path={`/users/${userId}`}>
          {(user) => (
            <Query path="/groups">
              {(groups) => (
                <div>
                  {Array.from(
                    new Set([
                      ...Object.keys(groups),
                      ...(user.groups ? Object.keys(user.groups) : []),
                    ])
                  ).map((groupId) => (
                    <div key={groupId}>
                      <input
                        type="checkbox"
                        checked={user.groups?.[groupId]}
                        onChange={(e) => setMember(groupId, e.target.checked)}
                        className="w-6 h-6"
                      />
                      &nbsp;{groups[groupId]?.name || groupId}
                    </div>
                  ))}
                </div>
              )}
            </Query>
          )}
        </Query>
      </div>
    </>
  );

  function setMember(groupId, isMember) {
    const ref = database.ref(`/users/${userId}/groups/${groupId}`);
    ref.set(isMember);
  }
}
