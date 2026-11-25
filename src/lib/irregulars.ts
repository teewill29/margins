// Irregular forms for formsOf (DETECTION.md section 3). Each verb row: base, past, participle.
// Alternatives are separated by "/". Rows are used in both directions.

const VERBS = `
arise arose arisen
awake awoke awoken
bear bore borne/born
beat beat beaten
become became become
begin began begun
bend bent bent
bet bet bet
bind bound bound
bite bit bitten
bleed bled bled
blow blew blown
break broke broken
breed bred bred
bring brought brought
build built built
burn burnt/burned burnt/burned
burst burst burst
buy bought bought
cast cast cast
catch caught caught
choose chose chosen
cling clung clung
come came come
cost cost cost
creep crept crept
cut cut cut
deal dealt dealt
dig dug dug
dive dove/dived dived
do did done
draw drew drawn
dream dreamt/dreamed dreamt/dreamed
drink drank drunk
drive drove driven
dwell dwelt dwelt
eat ate eaten
fall fell fallen
feed fed fed
feel felt felt
fight fought fought
find found found
flee fled fled
fling flung flung
fly flew flown
forbid forbade forbidden
forget forgot forgotten
forgive forgave forgiven
forsake forsook forsaken
freeze froze frozen
get got gotten/got
give gave given
go went gone
grind ground ground
grow grew grown
hang hung/hanged hung/hanged
have had had
hear heard heard
hew hewed hewn
hide hid hidden
hit hit hit
hold held held
hurt hurt hurt
keep kept kept
kneel knelt/kneeled knelt
knit knit/knitted knit/knitted
know knew known
lay laid laid
lead led led
lean leant/leaned leant/leaned
leap leapt/leaped leapt/leaped
learn learnt/learned learnt/learned
leave left left
lend lent lent
let let let
lie lay lain
light lit/lighted lit/lighted
lose lost lost
make made made
mean meant meant
meet met met
mistake mistook mistaken
mow mowed mown/mowed
pay paid paid
plead pled/pleaded pled/pleaded
prove proved proven
put put put
quit quit quit
read read read
rid rid rid
ride rode ridden
ring rang rung
rise rose risen
run ran run
saw sawed sawn
say said said
see saw seen
seek sought sought
sell sold sold
send sent sent
set set set
sew sewed sewn
shake shook shaken
shear sheared shorn
shed shed shed
shine shone shone
shoot shot shot
show showed shown
shrink shrank shrunk
shut shut shut
sing sang sung
sink sank sunk
sit sat sat
slay slew slain
sleep slept slept
slide slid slid
sling slung slung
slink slunk slunk
slit slit slit
smell smelt/smelled smelt/smelled
sneak snuck/sneaked snuck/sneaked
sow sowed sown
speak spoke spoken
speed sped sped
spell spelt/spelled spelt/spelled
spend spent spent
spill spilt/spilled spilt/spilled
spin spun spun
spit spat spat
split split split
spoil spoilt/spoiled spoilt/spoiled
spread spread spread
spring sprang sprung
stand stood stood
steal stole stolen
stick stuck stuck
sting stung stung
stink stank stunk
strew strewed strewn
stride strode stridden
strike struck struck/stricken
string strung strung
strive strove striven
swear swore sworn
sweat sweat/sweated sweat/sweated
sweep swept swept
swell swelled swollen
swim swam swum
swing swung swung
take took taken
teach taught taught
tear tore torn
tell told told
think thought thought
throw threw thrown
thrust thrust thrust
tread trod trodden
understand understood understood
wake woke woken
wear wore worn
weave wove woven
wed wed wed
weep wept wept
wet wet wet
win won won
wind wound wound
wring wrung wrung
write wrote written
`;

const PLURALS = `
tooth teeth
foot feet
goose geese
mouse mice
louse lice
man men
woman women
child children
ox oxen
person people
knife knives
wife wives
life lives
leaf leaves
loaf loaves
half halves
calf calves
wolf wolves
shelf shelves
thief thieves
scarf scarves
hoof hooves
elf elves
self selves
sheaf sheaves
die dice
cactus cacti
fungus fungi
`;

const rows = (src: string) =>
  src
    .trim()
    .split('\n')
    .map((l) => l.trim().split(/\s+/).flatMap((c) => c.split('/')));

/** Irregular verb rows: [base, ...pasts and participles]. */
export const IRREGULAR_VERBS: readonly string[][] = rows(VERBS).map((r) => [...new Set(r)]);
/** Irregular plural rows: [singular, plural]. */
export const IRREGULAR_PLURALS: readonly string[][] = rows(PLURALS);
