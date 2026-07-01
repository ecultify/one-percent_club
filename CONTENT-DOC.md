# INDIA KE TOP 1% — Full Content Document

> End-to-end, screen-by-screen content of the application, captured **word-for-word** from the live code (no paraphrasing). Dynamic values are shown in `{curly braces}` with a note. Questions follow at the end, organised **by set**, with the option images embedded.
>
> Two journeys exist:
> - **Part 1 — Single-player journey** (the homepage experience)
> - **Part 2 — Live multiplayer journey** (host-run rooms: player + spectator)
> - **Part 3 — Host console**
> - **Part 4 — Questions by set (A / B / C)**

---

# PART 1 — SINGLE-PLAYER JOURNEY (screen by screen)

## 1.1 Home / Landing
- Plays the home intro video (no on-screen text of its own).
- **Enter call-to-action** (circular gold button, fades in near the end of the intro video):
  - Button label: **`Enter`**
  - Accessibility label: `Enter experience`
- While the logo is centre-stage and still loading: **`Loading the experience`**
- (Dev-only badge, not shipped to players: `DEV · jumping to Q{n}`)

## 1.2 Welcome / Teaser video
- The teaser video plays full-screen. Skip control:
  - Button label: **`Skip`**  (accessibility label: `Skip video`)

## 1.3 Registration — "Enter the club" (UserDetailsModal)
- Kicker: **`Registration`**
- Heading: **`Enter the club`**
- Name field label: **`Your name`**
- Name field placeholder: **`Full name`**
- Mode toggle label: **`Game mode`**
  - Option 1: **`Single player`**
  - Option 2: **`Multiplayer`**
- (Multiplayer only) Invite-code field label: **`Invite code`**
  - Placeholder: **`ABCDEF`**
  - Helper text: **`Ask the host for the room code to join their live lobby.`**
- Submit button:
  - Single player: **`Continue`**
  - Multiplayer: **`Join lobby`**
- Spoken narration (audio, not on screen): *"Game shuroo karne se pehle, apna naam bata dijiye. Sirf ek chhoti si formality, phir asli game shuroo karte hain."*

## 1.4 Instructions (8 cinematic scenes)
Top-right skip (all but last scene): **`Skip ›`**

| Scene | On-screen text |
|---|---|
| 0 — On the floor | `Welcome to The 1% Club` · then the player's first name, e.g. `{firstName}.` |
| 1 — The count | `10` · `Sawaal` |
| 2 — The rule | `%` · `Har sawaal ka apna percentage.` |
| 3 — The warm-up | `90%` · `ka question har koi khel sakta hai` |
| 4 — The final filter | `1%` · `But only 1% people play the final question` |
| 5 — The clock | `Har question pe milenge aapko sirf 30 sec.` |
| 6 — Your weapons | `Logic.` · `Reasoning.` · `Instinct.` |
| 7 — Ready? | `Are you` · `ready?` |

- Final-scene button: **`Start the Game`**
- Chapter rail (bottom) tap labels (also the scene names): `On the floor`, `The count`, `The rule`, `The warm-up`, `The final filter`, `The clock`, `Your weapons`, `Ready?`

## 1.5 Ready-to-Play gate — "Tonight's Stage" (ReadyToPlayGate)
- Title: **`Tonight's Stage`**
- Three stat tiles (the big numbers `10`, `100`, `1cr` are **image glyphs**; the captions below are text):
  - **`Questions`** (glyph: 10)
  - **`Contestants`** (glyph: 100)
  - **`Cash prize`** (glyph: 1cr)
- Button: **`Start the game`**

## 1.6 Guided tour (before Q1)
**Tour prompt card**
- Kicker: **`Guided instructions`**
- Title: **`Pehle, kuch quick instructions`**
- Body: **`Main aapko quickly dikha deta hoon ki yeh game kaise khelna hai. Click below to begin, or skip straight to the first question.`**
- Primary button: **`Read Instructions`**
- Secondary button: **`Skip instructions`**

**Tour steps (coach-mark tooltips)**
1. Kicker `The question` — Title **`Read the question carefully`** — Body **`Every round shows one question. Read it slowly — the trick is usually hidden in the wording.`**
2. Kicker `Your answer` — Title **`Pick one of four diamonds`** — Body **`The four options appear as diamonds. Tap the one you think is correct before time runs out.`**
3. Kicker `The clock` — Title **`Watch the timer`** — Body **`Every question has a hard time limit. Hesitate too long and the clock will decide for you.`**
4. Kicker `The pot` — Title **`Every wrong answer feeds the pot`** — Body **`Stakes from eliminated players stack up here. Survive to the 1% and this prize could be yours.`**

**Ready gate card (after tour)**
- Kicker: **`Instructions complete`**
- Title: **`Ready to play?`**
- Body: **`The clock starts the moment you click below. First question is 90% — most of India gets it right. Don't be the outlier.`**
- Primary button: **`Start question 1`**
- Secondary button: **`Replay instructions`**

## 1.7 Question screen — interface chrome
*(The question text/options themselves are in Part 4. This is the surrounding UI.)*

- Top-left chip label: **`Pot`** (value formatted ₹, e.g. `₹28L`)
- Top-right chip label: **`Players`** (value `{remaining}/{total}`, e.g. `45/100`)
- Timer dock (desktop): countdown `{n}s`; pause/resume labels `Pause timer` / `Resume timer`; when paused shows **`Paused`**
- Mobile percentage chip caption: **`question`** (under the % number); timer label `Time left`
- Host status chip: **`Host is speaking`** (while narrating) / **`Host muted`** (when muted)
- Live unscored note: **`Playing along · unscored`**
- Heads-up hint chip (auto-dismisses ~5s):
  - Multi-image question: **`Swipe, or use the ‹ › arrows, to compare each photo — then tap a photo to lock it in.`**
  - Typed-answer question: **`Type your answer in the answer box, then hit Submit.`**
  - Other questions: **`Choose carefully — once you select and submit, there's no changing your answer.`**
- Typed-answer field placeholder: **`Type your answer here...`**
- Submit button: **`Submit`** (while grading: **`Checking…`**)
- Image-carousel arrows: `Previous photo` / `Next photo`

**Lifeline** (one per game, from the 50% question on; **never on the 1% question**)
- Button: **`Lifeline · Skip this question (1 left)`** (🛟)
- Armed (tap-again): **`Tap again to skip this question`**
- Accessibility label: `Use your skip-a-question lifeline`

**Answer-locked chip**
- Normal: **`Answer locked — waiting for the timer…`**
- After lifeline: **`Lifeline used — question skipped. Waiting for the timer…`**

**Result banners (on reveal)**
- Correct: **`Correct!`** (or, for "accept-any/observation" questions: **`Well observed.`**)
- Wrong: **`Wrong answer. It was {correct answer}`**
- Time up: **`Time's up.`** (+ correct answer)
- Lifeline-skipped: **`🛟 Lifeline used — you're safe this round. The answer was {correct answer}`**

**Live lock overlay (multiplayer, awaiting shared reveal)**
- Normal: **`Your answer is now locked`** · **`Sit tight for the answer reveal after the timer ends.`**
- Skipped: **`Question skipped — lifeline used`** · **`You're safe this round. Sit tight for the answer reveal after the timer ends.`**

## 1.8 After-round reveal (EliminationReveal)
- Header: **`After round`** · `{percentage}% question`
- Status chip: **`Survived`** (green) / **`Eliminated`** (red)
- Count headline label: **`Eliminated this round`** (with the animated number)
- Pot fill block: label **`Added this round`**, amount `+ ₹{added}`, breakdown **`{n} eliminated × ₹1L`**
- Pot total chip: **`Pot total`** `{₹ amount}`
- Delta block label: **`This round`** `+ ₹{added}`
- Stats: **`Still standing`** `{n}` · **`In the pot`** `{₹ amount}`
- Continue button: **`Next question`** (or **`See end screen`** on the last question)

## 1.9 Final result screen
- Left stat: label **`Questions correct`** — value `{correct}/{total}`
- Right stat: label **`In the pot`** — value `{₹ amount}`
- Gold tagline line 1: **`Make your brand a part of the 1% Club.`**
- Gold tagline line 2: **`Coming Soon · August 2026`**

## 1.10 Misc / global
- Mute button: **`Voice on`** / **`Muted`** (aria: `Mute narration` / `Unmute narration`)
- In-video skip control: **`Skip ▸`**
- "Coming soon" set gate: kicker **`Set B`**, heading **`Coming soon`**, body **`This set isn't available yet. Try Set A to play the current experience, or return to registration to choose again.`**, button **`Back to registration`**
- Tilt-your-phone notice (portrait video): **`Tilt your phone sideways`** · **`The video plays widescreen — turn your phone to watch it full size.`**

---

# PART 2 — LIVE MULTIPLAYER JOURNEY (screen by screen)

## 2.1 Join landing (JoinLanding)
**Host role** — kicker **`Host`**, title **`Host a 1% Club Quiz`**, subtitle **`Spin up a new room and share the code with your players.`**, button **`Create new room`**

**Participant role** — kicker **`Participant`**, title **`Join the Quiz`**, subtitle **`Enter the host's room code and your name to join.`**, fields **`Room code`** (placeholder `ABCDEF`) and **`Your name`** (placeholder `Required`), button **`Join quiz`**

**Viewer role** — kicker **`Viewer`**, title **`Watch a Live Quiz`**, subtitle **`Enter a room code to spectate in real time.`**, fields **`Room code`** (placeholder `ABCDEF`) and **`Display name (optional)`** (placeholder `Anonymous`), button **`Watch quiz`**

## 2.2 Live player intro (LivePlayerIntro)
**Teaser stage** — unmute button **`🔊 Tap for sound`** (when muted) · skip **`Skip intro →`**

**Instruction cards** (kicker shown above: **`The 1% Club`**)
1. Kicker **`How it works`** — Title **`One question at a time`** — Body **`The host runs the room. Each round a single question appears on your screen at the same moment for everyone.`**
2. Kicker **`Beat the clock`** — Title **`Lock your answer before time runs out`** — Body **`A timer counts down on every question. Type or tap your answer and submit before it hits zero — once you submit, it's locked in.`**
3. Kicker **`Survive`** — Title **`A wrong answer puts you out`** — Body **`Get it wrong or run out of time and you're eliminated, then watch the rest play out. Stay sharp and you could be the 1%.`**
- Buttons: **`Next`** (cards 1–2), **`I'm ready →`** (card 3), **`Skip`**

## 2.3 Audio gate (LiveAudioGate)
- Kicker: **`The 1% Club`**
- Heading: **`Join with your name and sound`** (name-collecting) / **`Tap to join with sound`** (no name)
- Body: **`One tap turns on the host voice and music. Your browser needs this each time you open the link before sound can play.`**
- Name placeholder: **`Your name`**
- Button: **`Enter with sound`** (busy: **`Starting…`**)

## 2.4 Connecting / Waiting lobby (play/[code])
- Connecting: **`Connecting to room {code}…`**
- Waiting lobby:
  - Kicker: **`Waiting for host`**
  - Heading: **`You're in, {name}. Sit tight.`** (the `, {name}` part is omitted if no name)
  - Sub-line: **`Room {code} · {n} player(s) joined`**
  - (If host conflict) **`Host is connected from another tab.`**

## 2.5 Late arrival / removed
**Late arrival**
- Kicker: **`Quiz in progress`** (or **`Quiz finished`** if ended)
- Heading: **`This lobby has already started`** (or **`This lobby has already finished`**)
- Body (in progress): **`You can still join as a viewer — you'll see every question live and play along for fun, but you won't be scored or eliminated.`**
- Body (finished): **`You can still hop in to see the final standings.`**
- Button: **`Play as a viewer`** (or **`See the results`** if finished)

**Removed (kicked)**
- Kicker: **`Removed`**
- Heading: **`You were removed from this room`**
- Body: **`The host removed you from this quiz.`**

## 2.6 In-game (player) — LiveQuizPlayer
- Joining: **`Joining…`** · loading a question: **`Loading question…`**
- (Uses the same question-screen chrome as Part 1.7.)
- **Eliminated choice screen:**
  - Kicker: **`Eliminated`**
  - Heading: **`You're out of the running`**
  - Body: **`That answer knocked you out — but the game isn't over for you. Keep playing along as a viewer (your answers won't count), or sit back and watch the survivors.`**
  - Buttons: **`Continue playing as viewer`** · **`Just watch`**

## 2.7 Spectator / Watch (watch/[code] + SpectatorView)
- Connecting: **`Connecting to room {code}…`**
- Spectator lobby: kicker **`Spectating`**, heading **`Room {code}`**, body **`Lobby — waiting for the host to start. You can jump in to play along once it begins.`**, section **`In the lobby`**, line **`{n} player(s) · {m} watching`**, empty **`No players yet.`**
- Between questions: **`Waiting for the next question…`**
- Top banners: **`You're out — spectating`** · **`Host is reading the question — timer starts soon`** · button **`Play as viewer ›`**
- Sidebar toggle: **`Hide players ›`** / **`‹ Players`**
- Participants sidebar: kicker **`Participants`**, heading **`{survivors} / {total} still in`**, **`Round {n} of {total}`**, **`{n} passed`** / **`{n} eliminated`** (on reveal) or **`{n} answered so far…`**, statuses **`spectating`** / **`out · Q{n}`** / **`score {n}`**, footer **`{n} watching`** (+ **`{n} playing along`**)

---

# PART 3 — HOST CONSOLE

## 3.1 Host dashboard (host)
- Page label: **`Host dashboard`**
- Heading: **`The 1% Club — your lobbies`**
- Subtitle: **`Rooms you created, plus ones you co-host. Start or end them individually.`**
- Set selector label: **`Question set`**
- Create button: **`Create room · {Set label}`** (busy: **`Creating…`**)
- Filter tabs: **`All`** · **`Open`** · **`Running`** · **`Finished`**
- Empty: **`No rooms yet. Click Create new room to spin up your first.`** · footnote **`Each room can hold ~100 players.`** · per-filter **`No {filter} rooms right now.`**
- Section headings: **`My rooms`** · **`Co-hosting`** (attribution: **`owned by {email}`**)

## 3.2 Focused room lobby + controls (host/[code])
- Breadcrumb: **`Back to dashboard`** · heading **`Room {code}`** · set badge
- Copy buttons: **`Play link`** · **`Watch link`**
- Errors: **`Host key rejected. Set NEXT_PUBLIC_HOST_KEY on Vercel and reload.`** · **`Another host is already controlling this room from a different tab.`**
- Phase badges: **`Lobby`** / **`Live`** / **`Ended`**
- Question counter: **`Q{n}/{total}`**
- Player summary: **`{n} player(s) · {n} still in · {n} viewer(s)`** (+ **` · {n} playing along`**)
- Buttons by phase: **`Start quiz`** (lobby) · **`Start Q{n}`** / **`End question`** / **`End quiz`** (running) · **`Reset to lobby`** (ended)
  - End-quiz confirm: title **`End the quiz now?`**, message **`The current standings are frozen.`**, confirm **`End quiz`**

**Host controls** (section: **`Host controls`** — **`Live controls you can change at any point during the game.`**)
- **`Manual questions`** (ON/OFF): **`You press Start to open each question's timer and End question to reveal early. Off = the server runs rounds automatically.`**
- **`Mute everyone`**: **`Silences the host voice-over AND the game-show audio for all players & viewers. Unmute individuals below in the participants table.`**
- **`Instructions screen`**: **`Whether joining players see the 3-page rules screen before the lobby. Affects players who join from now on.`**

**Narration** (section: **`Narration`** — lobby: **`Choose how questions are narrated. Locked once the quiz starts.`** / in-game: **`Locked — narration settings can only be changed in the lobby.`**)
- **`Read out`** (ON/OFF): **`You read each question aloud — every round holds with the timer frozen until you press Start question timer. No recorded voice-over plays.`**
- **`Mute VO`** (ON/OFF): **`Rounds follow normal server timing, but recorded voice-overs stay silent for the whole game.`** (+ **` (No effect while Read out is ON.)`**)
- In-game read-out helper: **`Read the question aloud, then press Start Q{n} above.`** · **`Clock running…`** · **`Revealing answer…`**

**Co-hosts** (section: **`Co-hosts`** — **`Add another host by email — they'll see this lobby on their own dashboard. They must have a host account (sign up at /host) first.`**)
- Placeholder: **`cohost@email.com`** · button **`Add co-host`** (busy **`Adding…`**)
- Success: **`Added {email} as a co-host.`**
- Errors: **`No host account with that email. Ask them to sign up at /host first.`** · **`Only the room owner can add co-hosts.`** · **`This room isn't in the registry yet — start it once, then invite.`** · **`That's you — you already own this room.`** · **`Please sign in again.`** · **`Couldn't add co-host.`** · **`Network error — try again.`**

**Participants table** (section: **`Participants`** — empty **`No one yet. Share the /play link.`**)
- Columns: **`Name`** · **`Status`** · **`Score`** · **`Time`** · **`Action`**
- Statuses: **`Playing along`** · **`Spectator`** · **`Out · Q{n}`** · **`In`** · **`Survived`** · **`Ready`**
- Actions: **`Mute`** / **`Unmute`** · **`Kick`** (confirm title **`Remove {name}?`**, confirm **`Remove`**)
- Analytics section title: **`Live stats`**

## 3.3 Dashboard room card (HostRoomCard)
- Stats: **`{n} joined`** · **`{n} still in`** / **`{n} ready`** · **`{n} viewer(s)`** · **`{n} playing along`**
- Buttons: **`Start quiz`** · **`Start Q{n}`** · **`End question`** · **`Mute everyone`** / **`Unmute everyone`** · **`End quiz`** · **`Reset to lobby`** · **`Open lobby`** · **`Remove from dashboard`** · **`Play link`** / **`Watch link`**
- End-quiz confirm: title **`End room {code}?`**, message **`All players freeze on their current question.`**, confirm **`End quiz`**
- Remove confirm: title **`Remove {code}?`**, message **`Deletes this lobby from your dashboard. The live room stays alive until everyone disconnects.`**, confirm **`Remove`**

## 3.4 Analytics panel (AnalyticsPanel)
- Title: **`Live stats`** · Tabs: **`Overview`** · **`Per-question`** · **`Eliminations`** · **`Play-along`**
- Overview labels: **`still in`** · **`players`** · **`answered this Q`** · **`current question`** · **`playing along`** · **`watching`**
- Per-question columns: **`Q`** · **`Answered`** · **`Correct`** · **`Eliminated`**
- Eliminations: empty **`No eliminations yet.`** · row **`Q{n} · {n} out`**
- Play-along columns: **`Name`** · **`Origin`** · **`Reached`** · **`Correct`** (origin values **`out Q{n}, continued`** / **`viewer`**); empty **`Nobody is playing along unscored.`**

## 3.5 Confirm dialog defaults
- Confirm: **`Confirm`** · Cancel: **`Cancel`** · running: **`Working…`**

---

# PART 4 — QUESTIONS BY SET

Each room plays one set (host picks at creation). Every set has **10 questions**, shown from **90% → 1%**. Each question has a 30-second timer. Correct answers shown are the in-app answer keys.

> **Note on a missing asset:** Set C, the 70% (Mandela) question currently has **no voice-over** recorded. Every other question in all 3 sets has one.

---

## SET A

### A — 90% · text answer
**`Which word becomes "shorter" when you add two letters to it?`**
- Answer: **SHORT** (short + ER → shorter)

### A — 80% · image + 2 options
**`What are there more of in this picture: cards or glasses?`**

![cards or glasses](<public/questionscreenimages/setquestions/a2-cards-glasses.jpg>)

- Options: `Cards` · `Glasses`
- Answer: **Glasses**

### A — 70% · image options (pick the photo)
**`Which of these photographs of Pandit Nehru cannot be real?`**

![Photo 1](<public/questionscreenimages/setquestions/nehru-optA.png>) ![Photo 2](<public/questionscreenimages/setquestions/nehru-optB.png>) ![Photo 3](<public/questionscreenimages/setquestions/nehru-optC.png>)

- Options: `Photo 1` · `Photo 2` · `Photo 3`
- Answer: **Photo 3**

### A — 60% · figure/letter sequence
**`Which figure and letter combination correctly completes the sequence?`**
- Sequence shown: `▲ A` · `● C` · `■ E` · `▲ G` · `● I` · `?`
- Options: `B ●` · `K ■` · `L ▲` · `Z ■`
- Answer: **K ■**

### A — 50% · text answer
**`A is the father of B. C is the sister of B. What is A's relationship to C?`**
- Answer: **Father** (A is C's father)

### A — 40% · text answer
**`If the first six months of the year are arranged alphabetically, which month comes third in the new order?`**
- Answer: **January** (April, February, January…)

### A — 30% · text answer
**`If January 1 is Day 1 and December 31 is Day 365, which month contains Day 155?`**
- Answer: **June** (Day 155 = June 4)

### A — 20% · clock image options
**`One clock is 15 minutes fast, one is 5 minutes slow, one has stopped, and one shows the correct time. Which clock is correct?`**

![Clock 1](<public/questionscreenimages/setquestions/clock-optA.png>) ![Clock 2](<public/questionscreenimages/setquestions/clock-optB.png>) ![Clock 3](<public/questionscreenimages/setquestions/clock-optC.png>) ![Clock 4](<public/questionscreenimages/setquestions/clock-optD.png>)

- Options: `Clock 1` · `Clock 2` · `Clock 3` · `Clock 4`
- Answer: **Clock 2**

### A — 10% · alphabet-gap word puzzle
**`A five-letter word is missing from this alphabetical sequence from A to Z. What is it?`**
- Sequence: `ABCDEFGIJKLMNPQRSVWXZ`
- Answer: **YOUTH** (missing letters: H O T U Y)

### A — 1% · image + text answer
**`What five-letter common English word comes next in this sequence?`**

![word sequence](<public/questionscreenimages/setquestions/a10-word-sequence.png>)

- Answer: **SCOLD** (hot → cold, s + COLD)

---

## SET B

### B — 90% · text answer
**`The opposite of long is short. What is the opposite of tall?`**
- Answer: **Short**

### B — 80% · image + text answer (Find the mistake)
**`What is the answer to this question?`**

![find the mistake](<public/questionscreenimages/question1(findthemistake-90)/q1mistake.png>)

- Answer: the word **"the"** appears twice (the article is doubled)

### B — 70% · image options (pick the photo)
**`Which photograph of Gandhiji cannot be real?`**

![Photo 1](<public/questionscreenimages/question2(gandhijirealornot-80)/gandhijiinaccurate.png>) ![Photo 2](<public/questionscreenimages/question2(gandhijirealornot-80)/gandhjiaccurate1-ezremove.png>) ![Photo 3](<public/questionscreenimages/question2(gandhijirealornot-80)/gandhjiaccurate2-ezremove.png>)

- Options: `Photo 1` · `Photo 2` · `Photo 3`
- Answer: **Photo 1**

### B — 60% · text answer
**`What occurs once in a minute, twice in a moment, but never in a thousand years?`**
- Answer: **The letter M**

### B — 50% · text answer
**`A is the father of B. B is the father of C. C is the brother of D. What is D to A?`**
- Answer: **Grandchild**

### B — 40% · text answer
**`If the flags of these 5 countries were arranged alphabetically, which country would come last: Australia, England, Ireland, Japan, India?`**
- Answer: **Japan**

### B — 30% · text answer
**`If January 1 is Day 1 and December 31 is Day 365, which month contains Day 215?`**
- Answer: **August** (Day 215 = August 3)

### B — 20% · pet images + name options
**`Rohan names his pets with the first letter of the animal — his dog is named Duncan. Which of these is NOT one of his pets' names?`**

![cat](<public/questionscreenimages/setquestions/pet-cat.png>) ![rabbit](<public/questionscreenimages/setquestions/pet-rabbit.png>) ![parrot](<public/questionscreenimages/setquestions/pet-parrot.png>) ![snake](<public/questionscreenimages/setquestions/pet-snake.png>) ![tortoise](<public/questionscreenimages/setquestions/pet-tortoise.png>)

- Options: `Caesar` · `Ronit` · `Pravin` · `Tina` · `Navin`
- Answer: **Navin** (no pet animal starts with N — Cat, Rabbit, Parrot, Snake, Tortoise)

### B — 10% · alphabet-gap word puzzle
**`A four-letter word is missing from this alphabetical sequence from A to Z. What is it?`**
- Sequence: `ABCDEGHIJKLMNPQSTVWXYZ`
- Answer: **FOUR** (missing letters: F O R U)

### B — 1% · image + text answer (blanks)
**`Which three letters replace the question marks so that both the blue and the pink underlined parts spell a word?`**

![letter blanks](<public/questionscreenimages/setquestions/b10-letter-blanks.png>)

- Answer: **UNT** (DISCO**UNT** · **UNT**ANGLED)

---

## SET C

### C — 90% · text answer
**`If you are running in a race and you pass the person in second place, what position are you in?`**
- Answer: **Second**

### C — 80% · flag image options
**`Spot what is wrong — one of these flags doesn't match its country. Which one?`**

![Ireland](<public/questionscreenimages/setquestions/flag-optA.png>) ![South Africa](<public/questionscreenimages/setquestions/flag-optB.png>) ![India](<public/questionscreenimages/setquestions/flag-optC.png>) ![Australia](<public/questionscreenimages/setquestions/flag-optD.png>) ![Italy](<public/questionscreenimages/setquestions/flag-optE.png>)

- Options: `Ireland` · `South Africa` · `India` · `Australia` · `Italy`
- Answer: **Australia** (the tile shows the wrong flag)

### C — 70% · image options (pick the photo) — *no VO yet*
**`Which of these photographs of Nelson Mandela cannot be real?`**

![Photo 1](<public/questionscreenimages/setquestions/mandela-optA.png>) ![Photo 2](<public/questionscreenimages/setquestions/mandela-optB.png>) ![Photo 3](<public/questionscreenimages/setquestions/mandela-optC.png>)

- Options: `Photo 1` · `Photo 2` · `Photo 3`
- Answer: **Photo 1**

### C — 60% · text answer
**`What starts with T, ends with T, and has T in it?`**
- Answer: **Teapot** (it has tea in it)

### C — 50% · text answer
**`A doctor and a boy were fishing. The boy was the doctor's son, but the doctor was not the boy's father. Who was the doctor?`**
- Answer: **His mother**

### C — 40% · sequence, text answer
**`What comes next in this sequence?`**
- Sequence shown: `J F M A M J J ?`
- Answer: **A** (the months January…July → next is August)

### C — 30% · text answer
**`If December 31 is Day 1 and January 1 is Day 365, which month contains Day 215?`**
- Answer: **May** (Day 215 = May 31)

### C — 20% · image + text answer
**`Who is holding the left hand of the child who is holding the left hand of the child who is next to a child whose right hand is not held by anyone?`**

![children holding hands](<public/questionscreenimages/setquestions/c8-children-hands.png>)

- Answer: **Dina**

### C — 10% · alphabet-gap word puzzle
**`A five-letter word is missing from this alphabetical sequence from A to Z. What is it?`**
- Sequence: `CDFGHIJKLMNOPQSTUVWXY`
- Answer: **ZEBRA** (missing letters: A B E R Z)

### C — 1% · image + text answer (blanks)
**`Surprisingly, there is only one word in the English language that can be made when you fill in these blanks so that the finished word contains no repeated letters. What is that word?`**

![13-letter blanks](<public/questionscreenimages/setquestions/c10-letter-blanks.png>)

- Answer: **UNPREDICTABLY** (a 13-letter isogram — no repeated letters)

---

*Document generated from the live source. The on-screen strings above are verbatim; image filenames link to the assets in `public/questionscreenimages/`.*
