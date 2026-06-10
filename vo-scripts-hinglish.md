# Question VO Scripts — Hinglish (ElevenLabs-ready)

Anil Kapoor-style host narration for every set question that still needs a VO.
26 unique scripts (A3 is reused for C3 — same Nehru question). Question VOs
only; correct/wrong reaction lines are NOT included here.

**Already covered (no script needed):**
- Set A Q2 (cards/glasses) → existing `q3VO(cardsnglasses).mp3`
- Set B Q2 (find the the mistake) → existing `q1VO(canyoufindthemistake).mp3`
- Set B Q3 (Gandhiji) → existing `q2VO(gandhiji).mp3`

**ElevenLabs notes:** use a multilingual model (v2/v3) so Hindi + English mix
renders cleanly. `<break time="0.5s" />` tags are supported (max 3s each).
Keep stability moderate (~0.5) for game-show energy.

**Wiring after generation (2 steps per file):**
1. Drop the mp3 at the target path below (create `public/questionscreenimages/setquestions/vo/`).
2. Fill the path in `SET_VO_FILES` (src/components/live/questionSets.ts) and the
   measured duration in `SET_VO_DURATION_MS` (src/lib/questionSetMeta.ts).
   When all are in, flip `QUESTION_VO_ENABLED` to `true` in questionSetMeta.ts.

---

## SET A

### A1 — 90% · "Which word becomes shorter when you add two letters?"
Target: `/questionscreenimages/setquestions/vo/a1VO.mp3`

```
Chaliye doston, shuru karte hain! <break time="0.4s" /> Pehla sawaal — nabbe percent ka, bilkul aasaan. <break time="0.5s" /> Which word becomes shorter… when you add two letters to it? <break time="0.7s" /> Shabdon ka khel hai — dhyaan se sochiye, aur apna answer type kijiye.
```

### A3 — 70% · Nehru photo that cannot be real  *(reuse this same file for C3)*
Target: `/questionscreenimages/setquestions/vo/a3VO.mp3`

```
Ab thoda dhyaan se. <break time="0.4s" /> Saamne hain Pandit Nehru ki teen tasveerein. <break time="0.5s" /> Which of these photographs cannot be real? <break time="0.7s" /> Har photo ko gaur se parkhiye… kahin kuch aisa hai jo us zamaane mein ho hi nahi sakta tha. <break time="0.5s" /> Photo select kijiye.
```

### A4 — 60% · Figure + letter sequence (▲A ●C ■E ▲G ●I ?)
Target: `/questionscreenimages/setquestions/vo/a4VO.mp3`

```
Saath percent ka sawaal — pattern ka khel. <break time="0.5s" /> Screen pe figures aur letters ki ek sequence hai — triangle ke saath A… circle ke saath C… square ke saath E… <break time="0.6s" /> Toh aage kya aayega? <break time="0.6s" /> Which figure and letter combination completes the sequence? <break time="0.5s" /> Pattern pakdiye, aur sahi option chuniye.
```

### A5 — 50% · A is the father of B…
Target: `/questionscreenimages/setquestions/vo/a5VO.mp3`

```
Pachaas percent — aadhi duniya yahin atak jaati hai. <break time="0.5s" /> A is the father of B. <break time="0.4s" /> C is the sister of B. <break time="0.5s" /> Toh bataiye — what is A's relationship to C? <break time="0.7s" /> Rishton ka hisaab lagaiye, aur apna answer type kijiye.
```

### A6 — 40% · First six months, alphabetical, third one
Target: `/questionscreenimages/setquestions/vo/a6VO.mp3`

```
Chaalis percent ka sawaal — calendar nikaaliye, dimaag mein. <break time="0.5s" /> Saal ke pehle chhe mahine — agar unhe alphabetical order mein lagaya jaaye… <break time="0.6s" /> which month comes third in the new order? <break time="0.7s" /> Letters se khelne ka waqt hai — sahi mahina type kijiye.
```

### A7 — 30% · Day 155 (forward count)
Target: `/questionscreenimages/setquestions/vo/a7VO.mp3`

```
Tees percent — ab game serious ho gaya hai. <break time="0.5s" /> Agar January first hai Day 1… aur December thirty-first hai Day 365… <break time="0.6s" /> toh Day one fifty-five kis mahine mein aayega? <break time="0.7s" /> Ginti shuru kijiye doston — mahine ka naam type kijiye.
```

### A8 — 20% · Four clocks, which is correct
Target: `/questionscreenimages/setquestions/vo/a8VO.mp3`

```
Bees percent ka sawaal — waqt ki baat. <break time="0.5s" /> Chaar ghadiyaan hain saamne. Ek pandrah minute aage hai… ek paanch minute peeche… ek band padi hai… <break time="0.6s" /> aur sirf ek dikha rahi hai sahi waqt. <break time="0.6s" /> Which clock shows the correct time? <break time="0.5s" /> Ghadi select kijiye.
```

### A9 — 10% · Missing five-letter word (alphabet sequence)
Target: `/questionscreenimages/setquestions/vo/a9VO.mp3`

```
Das percent — yahan tak sirf tez dimaag pahunchte hain. <break time="0.5s" /> A se Z tak ki sequence mein se paanch letters gayab hain… <break time="0.5s" /> aur woh paanch letters milkar banaate hain ek word. <break time="0.6s" /> Find the missing five-letter word. <break time="0.6s" /> Letters dhundhiye, word banaiye, type kijiye.
```

### A10 — 1% · Hidden-word sequence (five-letter word next)
Target: `/questionscreenimages/setquestions/vo/a10VO.mp3`

```
Aur ab… aakhri sawaal. Ek percent ka. <break time="0.8s" /> Screen pe words ki ek sequence hai — har word ke andar ek raaz chhupa hai. <break time="0.6s" /> What five-letter common English word comes next? <break time="0.7s" /> Yahi sawaal legends ko baaki sab se alag karta hai. <break time="0.5s" /> Apna answer type kijiye.
```

---

## SET B

### B1 — 90% · Opposite of tall
Target: `/questionscreenimages/setquestions/vo/b1VO.mp3`

```
Chaliye, shuru karte hain — pehla sawaal, nabbe percent ka. <break time="0.5s" /> The opposite of long is short. <break time="0.5s" /> Toh bataiye — what is the opposite of tall? <break time="0.7s" /> Saavdhan — sawaal jitna aasaan dikhta hai, utna hai nahi. <break time="0.4s" /> Answer type kijiye.
```

### B4 — 60% · Once in a minute, twice in a moment
Target: `/questionscreenimages/setquestions/vo/b4VO.mp3`

```
Saath percent ka sawaal — paheli ka waqt. <break time="0.5s" /> What occurs once in a minute… <break time="0.4s" /> twice in a moment… <break time="0.4s" /> but never in a thousand years? <break time="0.8s" /> Sochiye… jawab aapki aankhon ke bilkul saamne hai. <break time="0.5s" /> Type kijiye.
```

### B5 — 50% · D is what to A (grandchild)
Target: `/questionscreenimages/setquestions/vo/b5VO.mp3`

```
Pachaas percent — rishton ki kahaani. <break time="0.5s" /> A is the father of B. <break time="0.4s" /> B is the father of C. <break time="0.4s" /> C is the brother of D. <break time="0.6s" /> Toh D… A ka kya lagta hai? <break time="0.7s" /> Family tree banaiye dimaag mein, aur answer type kijiye.
```

### B6 — 40% · Five countries, alphabetically last
Target: `/questionscreenimages/setquestions/vo/b6VO.mp3`

```
Chaalis percent ka sawaal. <break time="0.5s" /> Paanch desh — Australia, England, Ireland, Japan, aur India. <break time="0.6s" /> Agar in deshon ko alphabetical order mein lagaya jaaye… which one comes last? <break time="0.7s" /> A se Z tak sochiye, aur desh ka naam type kijiye.
```

### B7 — 30% · Day 215 (forward count)
Target: `/questionscreenimages/setquestions/vo/b7VO.mp3`

```
Tees percent — numbers ka khel. <break time="0.5s" /> January first hai Day 1… December thirty-first hai Day 365. <break time="0.6s" /> Toh Day two fifteen kis mahine mein aata hai? <break time="0.7s" /> Mahino ki ginti lagaiye — aur mahine ka naam type kijiye.
```

### B8 — 20% · Rohan's pet names
Target: `/questionscreenimages/setquestions/vo/b8VO.mp3`

```
Bees percent ka sawaal — zara mazedaar hai. <break time="0.5s" /> Rohan apne pets ke naam rakhta hai animal ke pehle letter se — jaise uska dog hai Duncan. <break time="0.6s" /> Saamne hain uske paanch janwar. <break time="0.6s" /> Ab bataiye — in naamon mein se kaunsa naam uske kisi pet ka NAHI ho sakta? <break time="0.6s" /> Option chuniye.
```

### B9 — 10% · Missing four-letter word
Target: `/questionscreenimages/setquestions/vo/b9VO.mp3`

```
Das percent — manzil kareeb hai doston. <break time="0.5s" /> A se Z ki sequence mein se chaar letters gayab hain… aur woh chaar letters milkar banaate hain ek word. <break time="0.6s" /> Find the missing four-letter word. <break time="0.6s" /> Dhyaan se dekhiye, aur type kijiye.
```

### B10 — 1% · Three letters, two words (blue + pink)
Target: `/questionscreenimages/setquestions/vo/b10VO.mp3`

```
Aakhri sawaal — ek percent ka. <break time="0.7s" /> Screen pe ek word hai, beech mein teen letters gayab. <break time="0.6s" /> Which three letters complete BOTH words — blue waala bhi… aur pink waala bhi? <break time="0.8s" /> Yeh hai asli test. <break time="0.4s" /> Teen letters type kijiye.
```

---

## SET C

### C1 — 90% · Race, pass second place
Target: `/questionscreenimages/setquestions/vo/c1VO.mp3`

```
Chaliye doston, shuru karte hain — nabbe percent ka sawaal. <break time="0.5s" /> Aap ek race mein daud rahe hain… aur aapne second place waale runner ko overtake kar liya. <break time="0.6s" /> Ab aap kis position pe hain? <break time="0.7s" /> Jaldi mat kijiye — pehle sochiye, phir type kijiye.
```

### C2 — 80% · Spot the wrong flag
Target: `/questionscreenimages/setquestions/vo/c2VO.mp3`

```
Assi percent ka sawaal — duniya ke jhande. <break time="0.5s" /> Saamne paanch flags hain, paanch deshon ke naam ke saath. <break time="0.6s" /> Lekin inmein se ek flag… apne desh se match nahi karta. <break time="0.7s" /> Spot what is wrong — kaunsa flag galat hai? <break time="0.5s" /> Flag select kijiye.
```

### C3 — 70% · *(reuse `a3VO.mp3` — same Nehru question)*

### C4 — 60% · Starts with T, ends with T, has T in it
Target: `/questionscreenimages/setquestions/vo/c4VO.mp3`

```
Saath percent — shabdon ki paheli. <break time="0.5s" /> What starts with T… <break time="0.4s" /> ends with T… <break time="0.4s" /> and has T in it? <break time="0.8s" /> T se shuru, T pe khatam — aur andar bhi T? <break time="0.5s" /> Dimaag ghumaaiye, aur answer type kijiye.
```

### C5 — 50% · Doctor and the boy
Target: `/questionscreenimages/setquestions/vo/c5VO.mp3`

```
Pachaas percent ka sawaal — ek chhoti si kahaani. <break time="0.5s" /> Ek doctor aur ek ladka fishing kar rahe the. <break time="0.5s" /> Ladka doctor ka beta tha… lekin doctor us ladke ka pita nahi tha. <break time="0.7s" /> Toh doctor kaun tha? <break time="0.7s" /> Sochiye… aur apna answer type kijiye.
```

### C6 — 40% · J F M A M J J ?
Target: `/questionscreenimages/setquestions/vo/c6VO.mp3`

```
Chaalis percent — sequence ka sawaal. <break time="0.5s" /> J… F… M… A… M… J… J… <break time="0.7s" /> aage kya aayega? <break time="0.7s" /> Pattern pehchaniye doston — yeh letters aapne pehle bhi kahin dekhe hain. <break time="0.5s" /> Answer type kijiye.
```

### C7 — 30% · Day 215 (BACKWARDS count)
Target: `/questionscreenimages/setquestions/vo/c7VO.mp3`

```
Tees percent — is baar ulti ginti! <break time="0.5s" /> December thirty-first hai Day 1… aur January first hai Day 365. <break time="0.7s" /> Toh Day two fifteen kis mahine mein aayega? <break time="0.7s" /> Calendar ko ulta chalaiye — aur mahine ka naam type kijiye.
```

### C8 — 20% · Children holding hands
Target: `/questionscreenimages/setquestions/vo/c8VO.mp3`

```
Bees percent ka sawaal — kaan khol ke suniye. <break time="0.5s" /> Who is holding the left hand… of the child who is holding the left hand… of the child who is next to a child… whose right hand is not held by anyone? <break time="0.9s" /> Haan! Screen pe dobara padh lijiye. <break time="0.5s" /> Bachchon ke haath dhyaan se dekhiye, aur naam type kijiye.
```

### C9 — 10% · Missing five-letter word (ZEBRA sequence)
Target: `/questionscreenimages/setquestions/vo/c9VO.mp3`

```
Das percent — aakhri padaav ke bilkul kareeb. <break time="0.5s" /> Alphabet ki is sequence mein se paanch letters gayab hain — aur milkar banaate hain ek word. <break time="0.6s" /> Find the missing five-letter word. <break time="0.6s" /> Letters note kijiye, word banaiye, aur type kijiye.
```

### C10 — 1% · 13-letter word, fill the blanks
Target: `/questionscreenimages/setquestions/vo/c10VO.mp3`

```
Aur ab… ek percent ka sawaal. Yahan legends bante hain. <break time="0.8s" /> Screen pe ek adhoora word hai — poore terah letters ka. <break time="0.6s" /> Blanks bhariye… aur poora word bataiye. <break time="0.8s" /> Ek jawaab… aur naam history mein. <break time="0.5s" /> Type kijiye.
```
