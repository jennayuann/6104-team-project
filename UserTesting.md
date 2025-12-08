# Data Population Plan

Populate the app with data from cole's linked in and give the user that information. Also provide them with a new set of linked in data to import and add so they can test that functionality. 

# Task List
| Task Title                            | User Instruction                                                                                          | Rationale                                                                                                                                                                                      |
|----------------------------------------|----------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Log In                                | Log into your account using your provided credentials.                                                    | Tests the clarity and usability of the login process for real users, highlighting potential confusion or friction that might be overlooked by developers during walkthroughs.                  |
| Update Profile Name & Photo            | Change your account display name and upload a profile photo.                                              | Validates the discoverability and ease of use of account settings/personalization, ensuring users can find how to change profile details without hints.                                        |
| Manually Add a Network Node            | Add a new connection manually to your network by entering specific details.                               | Checks if users can find and complete the manual node addition workflow, surfacing interface pain points that may not be obvious when executing steps as a developer.                         |
| Import LinkedIn Connections            | Import your additional LinkedIn connections from the provided CSV or JSON file.                           | Tests import workflow and UI clarity, ensuring that users can independently find and trigger the import process, and that file-handling instructions are understandable and error-tolerant.    |
| Capture Network Screenshot             | Take a screenshot of your current network visualization.                                                  | Evaluates whether users can locate and use network visualization tools, and reveals if needed controls (like screenshot/export) are visible and usable in a real-user context.                |
| Search for a Specific Person           | Use the search functionality to find a specific person in your network.                                   | Assesses the intuitiveness of search for direct queries and whether it matches user expectations for search results and interaction patterns.                                                  |
| Search by Job Title                    | Search your network for people who are software engineers.                                                | Determines if the semantic search accommodates non-name-based queries, and if users naturally phrase and execute such searches, revealing gaps in UX or results relevance.                    |
| Search by Company                      | Search your network for someone who works at Google.                                                      | Shows whether the system supports organization-based search, helping uncover edge cases in company/entity disambiguation and surfacing issues with search accuracy or usability.               |

# Case Notes


[User test video (sped-up): https://youtu.be/PFMkJETPwyY]

## User 1 - Feedback, Notes

User feedback & flow (live while watching — refer to video):

- First, before even logging in: “What if I forget my password?” — didn’t have any option for that. (We don’t have password reset or recovery at all.)
- Logs in with username, no issue there.
- Gets to profile creation. Just stares at the form: totally unclear what any of the fields mean. “Need to enter a link” – user thinks maybe it’s about a company? (“Headline” is especially confusing. User literally asks “what does that mean?” Shrugs, ends up entering something personal (website), treats “headline” like a bio.)
- Clicking around to try to find out what things are: Hits the account icon, not the settings icon (actually finds better explanations there about profile info, which maybe means the navigation is weird).
- Upload + Save: Frustrating, needs to be one button (“Why is upload and save separate?”). Also, “saving takes forever,” and when it’s done things don’t update reliably in the profile.
- Trying to find/search networks: It defaults to network search, which throws user off — can’t tell where to go; search stuff is hidden. “Multi source network” tab — they say this is a terrible name, can’t find it, literally tries typing it into the network search (didn’t work). The filters are also not helpful (seems user thought filters let you add stuff).
- Goes to “multi source network” when prompted, pokes around. Ends up adding a root, not a connection — sort of stuck, doesn’t know what to do. “Add connection” is not discoverable enough.
- The whole “manage nodes/edges” is way too technical. User: “I just want to add a connection, not know how the database works. Just like LinkedIn!” Tags make no sense — “what are these? why do I fill this out?” Avatar URL is totally internal, no one knows what to do with a URL (should just upload a photo). Too much detail required, including “enter a JSON array” (!).
- Not clear you have to add an edge after a node. (No one will get this—should never have to write JSON or strings or anything nerdy as a user.)
- When they actually get to import, immediate success: Goes to the import tab and uploads with no problem. This workflow “should be everywhere.” Suggests “add a how-to on pulling LinkedIn links.”
- Goes back to multi-source network (they said only because they saw something “networky” before). Tries clicking on nodes (wants to find out who people are), can’t really tell. “Can I see different degrees? Maybe if I import others it’ll show degree of separation?” (Seems they expect more interaction/visual differentiation.)
- Search: tries to search in network, uses “network search” tab. “Public profiles” is a terrible name. Network search is way too slow; seems like nothing is happening. (Tries searching multiple times in the same bar.)
- Tries searching for “teacher” in network search, never tries public profiles (naming/discoverability issues). “I want to search anything anywhere.” Also noticed: tries adding “Google” and “McDonald’s” as root nodes. “Why do you even have to add roots? Feels like a lot just ends up in abyss.”
- UX meta-notes: “Should have a footer since you have no idea what’s going on or who made this.”
- “Why isn’t everything just one tab with logical groupings? How does filtering work?”
- One more: “If you have 500 dots you will not find anyone. Visualization is not useful unless it helps you navigate.”

tl;dr — Import is good and works/makes sense. Everything else: the user is confused, names are bad, flows are unclear, too much technical stuff (nodes/edges/JSON are not user-facing), and visualizations/search aren’t clear or useful. Needs a lot more help text and less dev-jargon everywhere.




# Improvement Opportunities

The biggest thing is that the front end dsign is poor. It should be simpler wiht buttons that prompt quick adn clear user floiws. "Add connection" pops up and takes a simple path to start and end with completeion. Same thing with linked in, accoutn creation and everywhere. A major theme with front end is to think about how the user will use the product and focus on that. NO decisions should be made on back end concepts or technical implemetaiton waht matters is the user flow not what the backend is expecting or what concept it is going to. The final thing is that the design colors were offputting and it made them less confident to navigate than websites and services that seemingly push you to exactly where you need to go. 

## Changes List
- Design overhaul
  - Change colors and make sharper look les lie the same buttons everywhere rename everythign to what hte user purpose is. 
- User flow overhall
  - One main page buttons bring up popups that are segments of user journey
  - Eg rather than node management just an add person button that then pops up and shows page by page. 
- Responsiveness
  - THe app needs tto be mroe responseive to show what is goign on the users trust slow stuff less
- Confirmation
  -   Each action should include some confirmation messgae to user only thing they were confident in was the uploading file 