/**
 * Synchronizations for LinkedInImport concept
 */

import { LinkedInImport, MultiSourceNetwork } from "@concepts";
import { actions, Sync } from "@engine";
import { ID } from "@utils/types.ts";

/**
 * Sync: When a LinkedIn connection is added, add it to the MultiSourceNetwork
 * 
 * This sync ensures that imported LinkedIn connections are automatically
 * added as nodes in the user's network graph with source "linkedin".
 */
export const AddLinkedInConnectionToNetwork: Sync = ({
  account,
  connection,
  user,
  connectionDoc,
}) => ({
  when: actions([
    LinkedInImport.addConnection,
    { account },
    { connection },
  ]),
  where: async (frames) => {
    // Query to get the user (owner) from the LinkedIn account
    frames = await frames.query(
      LinkedInImport._getAccountUser,
      { account },
      { user },
    );

    // Also fetch the full connection document so we can create a canonical node
    frames = await frames.query(
      LinkedInImport._getConnection,
      { connection },
      { connectionDoc },
    );

    return frames;
  },
  then: actions([
    MultiSourceNetwork.addOrMigrateNodeFromSource,
    {
      owner: user,
      legacyNodeId: connection,
      source: "linkedin" as ID,
      // connectionDoc may be an array result from the query; pass through as nodeMeta
      nodeMeta: (connectionDoc as unknown) as Record<string, unknown>,
      externalId: (connectionDoc && (connectionDoc as unknown as Record<string, unknown>[])[0]?.linkedInConnectionId) as string,
    },
  ]),
});

