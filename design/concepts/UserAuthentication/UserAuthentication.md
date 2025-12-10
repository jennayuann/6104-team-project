* **concept**: UserAuthentication [User]
* **purpose**: Provide username/password based registration and authentication.
* **principle**: After a user registers with a username and password they can authenticate using the same credentials. Passwords are stored hashed with a salt. Helper functions to hash and verify passwords are internal implementation details and should use timing-safe comparisons.

* **state**:
	* a set of `Users` with
		* `_id` User
		* `username` String
		* `passwordHash` String (stored as `salt:hash`)

* **actions**:
	* `register(username: String, password: String): { user: User } | { error: String }`
		* **requires**: `username` does not already exist
		* **effects**: creates a new user with a salted+hashed password and returns the new user id, or an error if username exists

	* `authenticate(username: String, password: String): { user: User } | { error: String }`
		* **requires**: `username` exists and `password` matches stored hash
		* **effects**: returns the authenticated user's id, or an error if credentials are invalid

	* `hashPassword(password: String): String`
		* **effects**: returns a salted hash string in the format `salt:hash`

	* `verifyPassword(password: String, stored: String): Boolean`
		* **effects**: verifies a plaintext password against the stored salted hash using a timing-safe comparison

* **queries**:
	* `_getUserById(id: User): { id: User, username: String } | {}`
		* **effects**: returns the user id and username if found, or empty object if not

	* `_getUserByUsername(username: String): Array<{ user: User }>`
		* **effects**: returns the user id if username exists, or empty array if not
