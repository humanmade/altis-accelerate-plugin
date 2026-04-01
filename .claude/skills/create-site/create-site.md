---
name: create-site
description: Create a new instance of Accelerate on InstaWP hosting, using the user-defined PR or file location (usually PR, number, which contains a download)
license: None
---

# Create Accelerate Site
- Leverages Claude Chrome (CC)

## Step 1 - Checks
- Use CC to navigate to https://app.instawp.io/sites
- Check top-right corner that current team is "Human Made"
- If yes, click "Add site", if no, stop and alert user.

## Step 2 - Add Site (Modal)
- The previous step of clicking "Add site" has opened a modal
- Find the field "Site Name" which is actually subdomain, use `cc-[random-word1]-[random-word2]` such as `cc-clumsy-goblin` (from the word lists below, all lowercase)

```js
const adjs2 = [
  "Grumpy", "Confused", "Screaming", "Judging", "Dancing", "Invisible", 
  "Aggressive", "Sleepy", "Nervous", "Heroic", "Drunken", "Clumsy", 
  "Suspicious", "Intellectual", "Desperate", "Sarcastic", "Vibrating", "Philosophical", "Chaotic", "Unstoppable", 
  "Apologetic", "Manic", "Ferocious", "Delirious", "Skeptical"
];

const nouns = [
  "Wombat", "Spatula", "Turnip", "Trousers", "Badger", "Toaster", 
  "Noodle", "Goblin", "Bucket", "Llama", "Potato", "Walrus", 
  "Banjo", "Cactus", "Burrito", "Platypus", "Accordion", "Dumpling", "Chainsaw", "Flamingo", 
  "Pickle", "Monocle", "Hamster", "Fridge", "Meatball"
];
``` 

- Leave other settings as-is, and click on "Next Step" (do no leave or refresh page, stay in modal as it'll live load the next screen)
- Another screen appears within the modal, no action, simply "Create Site" (the modal will disappear)

## Step 3 - Login
- Give it a moment to finish setting up the site (less than 30 seconds)
- Then you will see site details, click on "Magic Login" to be automatically logged in. 