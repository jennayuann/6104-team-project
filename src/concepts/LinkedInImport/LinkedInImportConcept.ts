import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Collection prefix to ensure namespace separation
const PREFIX = "LinkedInImport" + ".";

// Generic types for the concept's external dependencies
type User = ID;

// Internal entity types, represented as IDs
type LinkedInAccount = ID;
type Connection = ID;
type ImportJob = ID;

/**
 * State: A set of LinkedInAccounts with OAuth tokens and account information.
 */
interface LinkedInAccountDoc {
  _id: LinkedInAccount;
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  linkedInUserId: string;
  linkedInEmail?: string;
  linkedInName?: string;
  createdAt: Date;
  lastImportedAt?: Date;
}

/**
 * State: A set of Connections, representing imported LinkedIn connections.
 */
interface ConnectionDoc {
  _id: Connection;
  account: LinkedInAccount;
  linkedInConnectionId: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  location?: string;
  industry?: string;
  currentPosition?: string;
  currentCompany?: string;
  profileUrl?: string;
  profilePictureUrl?: string;
  summary?: string;
  skills?: string[];
  education?: Array<{
    school?: string;
    degree?: string;
    fieldOfStudy?: string;
    startYear?: number;
    endYear?: number;
  }>;
  experience?: Array<{
    title?: string;
    company?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  importedAt: Date;
  rawData?: Record<string, unknown>; // Store raw LinkedIn API response
}

/**
 * State: A set of ImportJobs tracking import operations.
 */
interface ImportJobDoc {
  _id: ImportJob;
  account: LinkedInAccount;
  status: "pending" | "in_progress" | "completed" | "failed";
  connectionsImported: number;
  connectionsTotal?: number;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * @concept LinkedInImport
 * @purpose Enable users to connect their LinkedIn account and import their connections with associated profile information into the system.
 * @principle When a user connects their LinkedIn account via OAuth and initiates an import, the system retrieves their connections and stores the public profile information (name, headline, location, experience, education, skills) for each connection, making this data available for network exploration and semantic search.
 */
export default class LinkedInImportConcept {
  accounts: Collection<LinkedInAccountDoc>;
  connections: Collection<ConnectionDoc>;
  importJobs: Collection<ImportJobDoc>;

  constructor(private readonly db: Db) {
    this.accounts = this.db.collection(PREFIX + "accounts");
    this.connections = this.db.collection(PREFIX + "connections");
    this.importJobs = this.db.collection(PREFIX + "importJobs");
  }

  /**
   * Action: Connects a LinkedIn account via OAuth.
   * connectLinkedInAccount (user: User, accessToken: String, refreshToken: String?, expiresAt: Date?, linkedInUserId: String, linkedInEmail: String?, linkedInName: String?): (account: LinkedInAccount)
   *
   * **requires**:
   *   - No LinkedInAccount exists for the given user.
   *   - accessToken is not empty.
   *   - linkedInUserId is not empty.
   *
   * **effects**:
   *   - Creates a new LinkedInAccount for the user with the provided OAuth tokens and profile information.
   *   - Returns the account ID.
   */
  async connectLinkedInAccount({
    user,
    accessToken,
    refreshToken,
    expiresAt,
    linkedInUserId,
    linkedInEmail,
    linkedInName,
  }: {
    user: User;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    linkedInUserId: string;
    linkedInEmail?: string;
    linkedInName?: string;
  }): Promise<{ account: LinkedInAccount } | { error: string }> {
    if (!accessToken || accessToken.trim() === "") {
      return { error: "accessToken is required and cannot be empty" };
    }
    if (!linkedInUserId || linkedInUserId.trim() === "") {
      return { error: "linkedInUserId is required and cannot be empty" };
    }

    // Check if account already exists for this user
    const existingAccount = await this.accounts.findOne({ user });
    if (existingAccount) {
      return {
        error: `LinkedIn account already exists for user ${user}. Use updateLinkedInAccount to update tokens.`,
      };
    }

    const accountId = freshID() as LinkedInAccount;
    await this.accounts.insertOne({
      _id: accountId,
      user,
      accessToken,
      refreshToken,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      linkedInUserId,
      linkedInEmail,
      linkedInName,
      createdAt: new Date(),
    });

    return { account: accountId };
  }

  /**
   * Action: Updates OAuth tokens for an existing LinkedIn account.
   * updateLinkedInAccount (account: LinkedInAccount, accessToken: String, refreshToken: String?, expiresAt: Date?): Empty
   *
   * **requires**:
   *   - A LinkedInAccount with the given account ID exists.
   *   - accessToken is not empty.
   *
   * **effects**:
   *   - Updates the accessToken, refreshToken, and expiresAt fields for the account.
   */
  async updateLinkedInAccount({
    account,
    accessToken,
    refreshToken,
    expiresAt,
  }: {
    account: LinkedInAccount;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }): Promise<Empty | { error: string }> {
    if (!accessToken || accessToken.trim() === "") {
      return { error: "accessToken is required and cannot be empty" };
    }

    const existingAccount = await this.accounts.findOne({ _id: account });
    if (!existingAccount) {
      return { error: `LinkedIn account with ID ${account} not found.` };
    }

    await this.accounts.updateOne(
      { _id: account },
      {
        $set: {
          accessToken,
          ...(refreshToken !== undefined && { refreshToken }),
          ...(expiresAt !== undefined && { expiresAt: new Date(expiresAt) }),
        },
      },
    );

    return {};
  }

  /**
   * Action: Disconnects a LinkedIn account.
   * disconnectLinkedInAccount (account: LinkedInAccount): Empty
   *
   * **requires**:
   *   - A LinkedInAccount with the given account ID exists.
   *
   * **effects**:
   *   - Removes the LinkedInAccount and all associated Connections and ImportJobs.
   */
  async disconnectLinkedInAccount({
    account,
  }: {
    account: LinkedInAccount;
  }): Promise<Empty | { error: string }> {
    const existingAccount = await this.accounts.findOne({ _id: account });
    if (!existingAccount) {
      return { error: `LinkedIn account with ID ${account} not found.` };
    }

    // Delete account, connections, and import jobs
    await Promise.all([
      this.accounts.deleteOne({ _id: account }),
      this.connections.deleteMany({ account }),
      this.importJobs.deleteMany({ account }),
    ]);

    return {};
  }

  /**
   * Action: Starts an import job to fetch connections from LinkedIn.
   * startImport (account: LinkedInAccount): (importJob: ImportJob)
   *
   * **requires**:
   *   - A LinkedInAccount with the given account ID exists.
   *   - The account's accessToken is valid (not expired).
   *
   * **effects**:
   *   - Creates a new ImportJob with status "pending".
   *   - Returns the importJob ID.
   */
  async startImport({
    account,
  }: {
    account: LinkedInAccount;
  }): Promise<{ importJob: ImportJob } | { error: string }> {
    const existingAccount = await this.accounts.findOne({ _id: account });
    if (!existingAccount) {
      return { error: `LinkedIn account with ID ${account} not found.` };
    }

    // Check if token is expired
    if (
      existingAccount.expiresAt &&
      existingAccount.expiresAt < new Date()
    ) {
      return {
        error:
          "LinkedIn access token has expired. Please refresh the token first.",
      };
    }

    const importJobId = freshID() as ImportJob;
    await this.importJobs.insertOne({
      _id: importJobId,
      account,
      status: "pending",
      connectionsImported: 0,
      startedAt: new Date(),
    });

    return { importJob: importJobId };
  }

  /**
   * Action: Adds a connection to the database (typically called during import).
   * addConnection (account: LinkedInAccount, linkedInConnectionId: String, firstName: String?, lastName: String?, headline: String?, location: String?, industry: String?, currentPosition: String?, currentCompany: String?, profileUrl: String?, profilePictureUrl: String?, summary: String?, skills: String[]?, education: JSON?, experience: JSON?, rawData: JSON?): (connection: Connection)
   *
   * **requires**:
   *   - A LinkedInAccount with the given account ID exists.
   *   - linkedInConnectionId is not empty.
   *
   * **effects**:
   *   - Creates or updates a Connection with the provided information.
   *   - If a connection with the same account and linkedInConnectionId exists, updates it.
   *   - Returns the connection ID.
   */
  async addConnection({
    account,
    linkedInConnectionId,
    firstName,
    lastName,
    headline,
    location,
    industry,
    currentPosition,
    currentCompany,
    profileUrl,
    profilePictureUrl,
    summary,
    skills,
    education,
    experience,
    rawData,
  }: {
    account: LinkedInAccount;
    linkedInConnectionId: string;
    firstName?: string;
    lastName?: string;
    headline?: string;
    location?: string;
    industry?: string;
    currentPosition?: string;
    currentCompany?: string;
    profileUrl?: string;
    profilePictureUrl?: string;
    summary?: string;
    skills?: string[];
    education?: Array<{
      school?: string;
      degree?: string;
      fieldOfStudy?: string;
      startYear?: number;
      endYear?: number;
    }>;
    experience?: Array<{
      title?: string;
      company?: string;
      startDate?: string;
      endDate?: string;
      description?: string;
    }>;
    rawData?: Record<string, unknown>;
  }): Promise<{ connection: Connection } | { error: string }> {
    if (!linkedInConnectionId || linkedInConnectionId.trim() === "") {
      return { error: "linkedInConnectionId is required and cannot be empty" };
    }

    const existingAccount = await this.accounts.findOne({ _id: account });
    if (!existingAccount) {
      return { error: `LinkedIn account with ID ${account} not found.` };
    }

    // Check if connection already exists
    const existingConnection = await this.connections.findOne({
      account,
      linkedInConnectionId,
    });

    if (existingConnection) {
      // Update existing connection
      await this.connections.updateOne(
        { _id: existingConnection._id },
        {
          $set: {
            ...(firstName !== undefined && { firstName }),
            ...(lastName !== undefined && { lastName }),
            ...(headline !== undefined && { headline }),
            ...(location !== undefined && { location }),
            ...(industry !== undefined && { industry }),
            ...(currentPosition !== undefined && { currentPosition }),
            ...(currentCompany !== undefined && { currentCompany }),
            ...(profileUrl !== undefined && { profileUrl }),
            ...(profilePictureUrl !== undefined && { profilePictureUrl }),
            ...(summary !== undefined && { summary }),
            ...(skills !== undefined && { skills }),
            ...(education !== undefined && { education }),
            ...(experience !== undefined && { experience }),
            ...(rawData !== undefined && { rawData }),
            importedAt: new Date(),
          },
        },
      );
      return { connection: existingConnection._id };
    } else {
      // Create new connection
      const connectionId = freshID() as Connection;
      await this.connections.insertOne({
        _id: connectionId,
        account,
        linkedInConnectionId,
        firstName,
        lastName,
        headline,
        location,
        industry,
        currentPosition,
        currentCompany,
        profileUrl,
        profilePictureUrl,
        summary,
        skills: skills || [],
        education: education || [],
        experience: experience || [],
        importedAt: new Date(),
        rawData,
      });
      return { connection: connectionId };
    }
  }

  /**
   * Action: Updates the status of an import job.
   * updateImportJobStatus (importJob: ImportJob, status: String, connectionsImported: Number, connectionsTotal: Number?, errorMessage: String?): Empty
   *
   * **requires**:
   *   - An ImportJob with the given importJob ID exists.
   *   - status is one of: "pending", "in_progress", "completed", "failed".
   *
   * **effects**:
   *   - Updates the import job's status, progress, and optional error message.
   *   - Sets completedAt if status is "completed" or "failed".
   */
  async updateImportJobStatus({
    importJob,
    status,
    connectionsImported,
    connectionsTotal,
    errorMessage,
  }: {
    importJob: ImportJob;
    status: "pending" | "in_progress" | "completed" | "failed";
    connectionsImported: number;
    connectionsTotal?: number;
    errorMessage?: string;
  }): Promise<Empty | { error: string }> {
    const validStatuses = ["pending", "in_progress", "completed", "failed"];
    if (!validStatuses.includes(status)) {
      return {
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      };
    }

    const existingJob = await this.importJobs.findOne({ _id: importJob });
    if (!existingJob) {
      return { error: `Import job with ID ${importJob} not found.` };
    }

    const updateData: Partial<ImportJobDoc> = {
      status,
      connectionsImported,
      ...(connectionsTotal !== undefined && { connectionsTotal }),
      ...(errorMessage !== undefined && { errorMessage }),
    };

    if (status === "completed" || status === "failed") {
      updateData.completedAt = new Date();
    }

    await this.importJobs.updateOne({ _id: importJob }, { $set: updateData });

    // Update lastImportedAt on the account when import completes
    if (status === "completed") {
      await this.accounts.updateOne(
        { _id: existingJob.account },
        { $set: { lastImportedAt: new Date() } },
      );
    }

    return {};
  }

  /**
   * Query: Retrieves the LinkedIn account for a user.
   */
  async _getLinkedInAccount({
    user,
  }: {
    user: User;
  }): Promise<LinkedInAccountDoc[]> {
    return await this.accounts.find({ user }).toArray();
  }

  /**
   * Query: Retrieves all connections for a LinkedIn account.
   */
  async _getConnections({
    account,
  }: {
    account: LinkedInAccount;
  }): Promise<ConnectionDoc[]> {
    return await this.connections.find({ account }).toArray();
  }

  /**
   * Query: Retrieves a connection by LinkedIn connection ID.
   */
  async _getConnectionByLinkedInId({
    account,
    linkedInConnectionId,
  }: {
    account: LinkedInAccount;
    linkedInConnectionId: string;
  }): Promise<ConnectionDoc[]> {
    return await this.connections
      .find({ account, linkedInConnectionId })
      .toArray();
  }

  /**
   * Query: Retrieves all import jobs for a LinkedIn account.
   */
  async _getImportJobs({
    account,
  }: {
    account: LinkedInAccount;
  }): Promise<ImportJobDoc[]> {
    return await this.importJobs.find({ account }).toArray();
  }

  /**
   * Query: Retrieves the most recent import job for a LinkedIn account.
   */
  async _getLatestImportJob({
    account,
  }: {
    account: LinkedInAccount;
  }): Promise<ImportJobDoc[]> {
    const jobs = await this.importJobs
      .find({ account })
      .sort({ startedAt: -1 })
      .limit(1)
      .toArray();
    return jobs;
  }
}

