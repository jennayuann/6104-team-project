/**
 * Sync: Create canonical nodes and migrate memberships when LinkedIn connections are added.
 *
 * This runs separately from AddLinkedInConnectionToNetwork and preserves the
 * original LinkedInImport action signatures. It upserts a canonical Node in
 * MultiSourceNetwork and migrates any legacy membership that referenced the
 * LinkedIn connection id to the canonical node id.
 */

import { LinkedInImport, MultiSourceNetwork } from "@concepts";
import { actions, Sync } from "@engine";
import { ID } from "@utils/types.ts";

export const CreateCanonicalNodeFromLinkedInConnection: Sync = (
  { account, connection, user, connectionDoc },
) => ({
  when: actions([
    LinkedInImport.addConnection,
    { account },
    { connection },
  ]),
  where: async (frames) => {
    // Bind owner (user)
    frames = await frames.query(LinkedInImport._getAccountUser, { account }, {
      user,
    });
    // Bind the full connection document
    frames = await frames.query(LinkedInImport._getConnection, { connection }, {
      connectionDoc,
    });
    return frames;
  },
  then: actions([
    MultiSourceNetwork.addOrMigrateNodeFromSource,
    {
      owner: user,
      legacyNodeId: connection,
      source: "linkedin" as ID,
      nodeMeta: connectionDoc,
      externalId:
        (connectionDoc as unknown as { linkedInConnectionId?: string })
          ?.linkedInConnectionId,
    },
  ]),
});
