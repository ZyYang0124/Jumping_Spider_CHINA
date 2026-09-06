# China Salticid Field Notes — Master Development Prompt

You are the lead product engineer, full-stack developer, database architect, and UI/UX designer for this project.

Your task is to design and implement a production-quality personal natural-history website for documenting jumping spider observations in China.

Do not treat this as a generic CRUD application.

Do not turn it into a comprehensive Chinese Salticidae database.

Do not turn it into iNaturalist, GBIF, World Spider Catalog, or a public citizen-science platform.

The central concept is:

> Every record begins with an observation, not a species entry.

The website should feel like the long-term digital field notebook of a jumping-spider taxonomist and his invited collaborators: photography-first, highly personal, scientifically credible, carefully curated, and visually refined.

---

# 0. Project philosophy

The product should answer:

> Where, when, and how did we encounter these jumping spiders?

It should NOT primarily answer:

> What jumping spider species exist in China?

The site is a personal, curated natural-history archive based on:

- field observations
- live photographs
- habitat photographs
- behavior notes
- field trips
- specimens when available
- taxonomic identifications
- invited collaborators' observations

Incomplete coverage is expected and desirable.

A species should normally appear because it has been observed within this project.

Do not build completeness metrics such as:

- percentage of Chinese species covered
- authoritative national checklist
- database completion rate

Do not imply that site records represent the complete distribution of any species.

---

# 1. Working project name

Use the working name:

China Salticid Field Notes

Chinese display name:

中国跳蛛观察志

Use the name through a central site configuration so it can be renamed later without editing components individually.

Suggested subtitle:

> Jumping spiders encountered through fieldwork and everyday observations in China.

Chinese:

> 记录我们在中国野外调查与日常观察中遇见的跳蛛。

---

# 2. Core product principles

All implementation decisions must follow these principles.

## P1. Observation First

`Observation` is the fundamental entity.

Species pages are aggregated views derived from observations.

Do not design the system around manually authored species encyclopedia entries.

---

## P2. Personal First

The site is a natural-history work, not an institutional database portal.

Prioritize:

1. photography
2. place and date
3. field story
4. identification
5. structured metadata

Avoid database-dashboard aesthetics on public pages.

---

## P3. Curated, not crowdsourced

Public registration is forbidden in MVP.

Only invited contributors may have accounts.

Contributor submissions are never automatically published.

Every submitted observation must pass editorial review.

---

## P4. Identification is evidence-aware

Not all identifications are equally certain.

Identification confidence/evidence must be explicit.

Supported levels:

- tentative
- photo_based
- specimen_examined
- genitalia_confirmed
- molecularly_supported

The UI should translate these values into human-readable labels.

---

## P5. Taxonomy changes

Observations must remain valid even when identifications change.

Never store the scientific name as the authoritative identity directly on the observation.

An observation links to one or more `Identification` records.

The current identification may change without changing the observation ID or URL.

---

## P6. Unknown taxa are valid

The system must support observations with:

- no identification
- family-level identification
- tribe-level identification
- genus-level identification
- `cf.`
- `aff.`
- provisional morphospecies

Examples:

- Salticidae sp.
- Chrysillini sp.
- Phintella sp. YN01
- Siler cf. cupreus

Never force a species-level identification.

---

## P7. Photography First

Photographs are first-class data.

Original uploaded media must be preserved unchanged.

Web derivatives may be generated separately.

---

## P8. Privacy First

Exact coordinates may contain sensitive biological information.

Never expose exact coordinates to the public unless the record is explicitly marked `exact`.

Coordinate privacy must be enforced server-side.

Do not send exact coordinates to the browser and then blur them in JavaScript.

---

# 3. Technology stack

Use:

## Application

- Next.js
- TypeScript
- App Router
- Server Components where appropriate
- Server Actions or clearly defined API routes for mutations

## UI

- Tailwind CSS
- shadcn/ui only for generic controls and Studio interfaces
- custom visual components for public-facing content

## Database

- PostgreSQL
- Supabase

## Authentication

- Supabase Auth

## Authorization

- PostgreSQL Row Level Security
- application-layer permission checks as defense in depth

## Media

Preferred:

- Cloudflare R2 for originals and derivatives

If R2 credentials are not available during local development:

- provide a storage adapter
- use a local/mock implementation
- do not tightly couple domain logic to one storage vendor

## Maps

- MapLibre GL JS

Keep map provider configuration replaceable.

## Deployment

- Vercel

## Source control

- GitHub

---

# 4. Environment separation

Support:

- development
- preview
- production

Never connect local development directly to the production database.

Use `.env.example`.

Never commit credentials.

Environment variables should be validated on startup.

---

# 5. User roles

Use four conceptual roles:

```text
visitor
contributor
editor
owner
```

## Visitor

Can:

- browse published observations
- browse species aggregation pages
- browse trips
- browse contributors who opted into public profiles
- search
- view public maps

Cannot modify anything.

---

## Contributor

Invitation only.

Can:

- create observations
- upload media
- edit own drafts
- submit observations
- view own private submissions
- respond to revision requests

Cannot:

- publish observations
- modify taxonomy
- edit other contributors' records
- change editorial identification
- access protected exact coordinates belonging to other users
- manage users

---

## Editor

Can:

- review submissions
- request revision
- edit metadata
- add identifications
- approve records
- publish records if granted appropriate permission
- manage ordinary taxon records

Cannot manage owner-level site configuration unless explicitly granted.

---

## Owner

Full access.

Owner can:

- manage contributors
- review
- publish
- unpublish
- archive
- manage taxonomy
- manage trips
- manage locations
- access exact coordinates
- manage sensitive records
- manage site configuration

---

# 6. Authentication policy

MVP must NOT include public sign-up.

Implement invitation-only contributor access.

Possible implementation:

- owner creates invitation
- invited user receives token/link
- user creates account
- role defaults to `contributor`

Design the invitation layer so email delivery can be added later if not immediately configured.

Never expose an unrestricted `/signup` page.

---

# 7. Observation lifecycle

Implement the following finite state machine:

```text
draft
  ↓
submitted
  ↓
review
  ├──→ revision_requested
  │       ↓
  │    submitted
  │
  ├──→ approved
  │       ↓
  │    published
  │
  └──→ rejected
```

Also support:

```text
published → archived
```

Do not hard-delete scientific observations through normal UI.

Statuses:

- draft
- submitted
- review
- revision_requested
- approved
- published
- rejected
- archived

Invalid state transitions must be rejected server-side.

---

# 8. Stable observation IDs

Every observation receives an immutable public identifier.

Suggested format:

```text
CSFN-2026-000001
CSFN-2026-000002
```

Do not include:

- taxon name
- province
- contributor name
- locality

in the permanent ID.

Public URL:

```text
/observations/CSFN-2026-000001
```

Once created, the public ID never changes.

---

# 9. Core data model

Build the first schema around the following tables.

Do not add unnecessary tables unless a concrete requirement requires them.

```text
profiles
invitations

observations
observation_people

locations

media

taxa
identifications

trips
trip_observations

specimens

audit_logs

site_settings
```

Use UUID primary keys internally.

Use stable human-readable identifiers separately where appropriate.

---

# 10. profiles

Suggested fields:

```text
id
auth_user_id

display_name
slug

bio
avatar_media_id

role

profile_visibility
show_observation_count

created_at
updated_at
```

`profile_visibility`:

```text
public
private
```

Do not require contributors to expose personal profiles publicly.

---

# 11. observations

Suggested fields:

```text
id
public_id

created_by
primary_observer_id

observed_at
observed_at_precision

location_id

sex
life_stage

habitat
microhabitat
behavior

field_note

status
visibility

submitted_at
approved_at
published_at
archived_at

created_at
updated_at
```

Do not add `scientific_name` as an authoritative observation field.

Do not store taxonomic identity directly here.

---

# 12. Observation people

Do not collapse all human roles into one user.

Support:

- observer
- contributor
- identifier
- photographer
- collector

Use an association model where useful.

A possible observation:

```text
Observed by: Zhang San
Uploaded by: Li Si
Photographed by: Zhang San
Identified by: Zhiyong Yang
```

must be representable accurately.

Also support people who do not have accounts.

---

# 13. locations

Suggested fields:

```text
id

country
state_province
city
county
locality

exact_latitude
exact_longitude

public_latitude
public_longitude

coordinate_uncertainty_m

elevation_m

location_visibility

created_by
created_at
updated_at
```

`location_visibility`:

```text
exact
blurred
locality_only
hidden
```

Rules:

### exact

Public may receive exact coordinates.

### blurred

Public API receives only derived/coarsened public coordinates.

### locality_only

No geographic coordinates are sent publicly.

Only textual locality is shown.

### hidden

Neither coordinates nor sensitive locality detail are public.

Never calculate public blurring only in the browser.

Prefer deterministic server-side/public coordinates so a record does not jump around every request.

---

# 14. media

Suggested fields:

```text
id
observation_id

storage_key_original

storage_key_thumb
storage_key_medium
storage_key_large

mime_type
width
height
file_size

media_type
view_type

caption
sort_order
is_cover

photographer_name
photographer_profile_id

copyright_holder
license

visibility

exif_json_private

uploaded_by
created_at
```

`visibility`:

```text
public
private
embargoed
```

---

# 15. Media view types

Use a controlled enum.

Initial list:

```text
live_dorsal
live_frontal
live_lateral

behavior
habitat

specimen_dorsal
specimen_ventral

male_palp
epigyne
vulva

microscopy
other
```

Do not implement uncontrolled arbitrary tags for this.

---

# 16. Image handling rules

Original media is immutable.

Pipeline:

```text
upload
↓
validate
↓
store original
↓
extract technical metadata
↓
read EXIF privately
↓
generate web derivatives
↓
strip sensitive EXIF from public derivatives
↓
store derivative references
```

Generate at least:

```text
thumbnail ~400 px
medium ~1200 px
large ~2400 px
```

Prefer AVIF/WebP derivatives where appropriate.

Keep the original uploaded file.

Do not overwrite it after:

- rotation
- crop
- compression
- color adjustment

Create derivatives instead.

---

# 17. EXIF privacy

This is a hard security requirement.

Publicly downloadable/rendered derivatives must not expose original GPS EXIF.

Private original media may retain EXIF.

If GPS is detected during upload:

- parse it
- show the contributor the detected location
- ask them to confirm or modify it
- do not silently publish it

---

# 18. taxa

Keep taxonomy intentionally lightweight.

Suggested fields:

```text
id

rank
scientific_name
authorship

parent_id

status
accepted_taxon_id

slug

chinese_name

created_at
updated_at
```

Possible status:

```text
accepted
synonym
provisional
unresolved
```

Only create taxa needed by the site's observations and editorial work.

Do not bulk-import the entire World Spider Catalog.

---

# 19. identifications

This is a critical table.

Suggested fields:

```text
id

observation_id
taxon_id

display_identification

identified_by_profile_id
identified_by_text

identified_at

confidence
evidence

remarks

is_current

created_at
```

Possible confidence/evidence values:

```text
tentative
photo_based
specimen_examined
genitalia_confirmed
molecularly_supported
```

Only one identification should normally be `is_current = true`.

Changing the current identification must NOT delete previous identifications.

Maintain identification history.

Example:

```text
2026
Siler cf. cupreus
photo_based

2027
Siler sp. A
specimen_examined

2029
Siler yangi
genitalia_confirmed
```

The observation URL remains unchanged.

---

# 20. specimens

Optional per observation.

Suggested fields:

```text
id
observation_id

collector
catalog_number
field_number

repository
preservation

sex
life_stage

notes

created_at
updated_at
```

The public Observation page only renders this section if specimen information exists and is allowed to be public.

---

# 21. trips

Trips are first-class editorial content.

Suggested fields:

```text
id
slug

title
subtitle

start_date
end_date

cover_media_id

summary
story

visibility
published_at

created_by
created_at
updated_at
```

Trip pages should feel like field journals, not reports.

Observations may belong to zero, one, or multiple trips if needed, although one primary trip is usually enough.

---

# 22. audit_logs

Any meaningful editorial mutation should be logged.

Suggested fields:

```text
id

actor_profile_id

entity_type
entity_id

action

before_json
after_json

created_at
```

Log at least:

- submission
- review start
- revision request
- approval
- publication
- archival
- identification change
- coordinate visibility change
- sensitive media visibility change

---

# 23. Soft deletion

Do not hard-delete published scientific records through the normal application.

Use:

```text
archived_at
```

or an archived state.

True permanent purge must be owner-only and intentionally difficult.

---

# 24. Contributor upload UX

Do not present a 40-field museum form.

Create a friendly multi-step observation workflow.

## Step 1 — Photos

- drag and drop
- multi-file upload
- reorder
- choose cover
- preview
- upload progress
- remove before submission

## Step 2 — When & where?

Fields:

- observation date
- province
- city/county
- locality
- map pin
- elevation

If EXIF has date/GPS:

- prefill as suggestions
- visibly indicate source
- require user confirmation

## Step 3 — What did you see?

Fields:

- tentative identification
- sex
- life stage
- habitat
- microhabitat
- behavior

Identification is explicitly a contributor suggestion, not the authoritative determination.

## Step 4 — Field note

Provide a comfortable text editor.

Prompt gently with ideas such as:

- where exactly was it found?
- what was it doing?
- what substrate was it on?
- anything unusual?

Do not force scientific prose.

## Step 5 — Review and submit

Display:

- photos
- date
- public locality preview
- tentative identification
- field note
- location privacy

Require acknowledgement of upload/copyright terms.

---

# 25. Contributor agreement

On first submission or first account activation, require agreement to simple terms:

1. I own or have permission to upload the submitted media.
2. The website may display the media and observation metadata.
3. Copyright remains with the copyright holder unless another license is selected.
4. Editors may correct metadata and scientific identifications.
5. Sensitive coordinates may be generalized or hidden.
6. Submission does not guarantee publication.

Do not make the user transfer copyright to the website.

---

# 26. Licensing

For each media item support:

```text
all_rights_reserved
CC_BY_4_0
CC_BY_NC_4_0
```

Default:

```text
all_rights_reserved
```

Always display photographer/copyright attribution where appropriate.

---

# 27. Public information architecture

MVP routes:

```text
/
 /observations
 /observations/[publicId]

 /species
 /species/[slug]

 /trips
 /trips/[slug]

 /places

 /contributors
 /contributors/[slug]

 /about

 /login

 /studio
```

Do not create excessive taxonomy hierarchy pages during MVP.

---

# 28. Homepage

The homepage must be visual and editorial.

It must NOT look like a data portal dashboard.

Suggested structure:

## Hero

Large high-quality spider photograph.

Title:

China Salticid Field Notes

Chinese title may also be displayed:

中国跳蛛观察志

Short sentence:

> Jumping spiders encountered through fieldwork and everyday observations in China.

Primary actions:

- Browse observations
- Explore field trips

Do not use large database counters as the dominant hero message.

---

## Recent field notes

Show recent observations with strong photography.

Cards should emphasize:

- image
- identification
- locality
- date

---

## From the field

Featured field trips.

---

## Explore places

Map or location-focused entry point.

---

## Friends' observations

A small, warm section for invited contributor records.

Do not create rankings or leaderboards.

---

# 29. Observation detail page

Public structure:

## Hero

Large cover photo.

Display:

```text
Current identification
Date
Place
Observer
```

---

## Field note

This should receive generous typographic treatment.

It is one of the most important parts of the website.

---

## Photographs

Photography-first gallery.

Support:

- responsive grid
- lightbox
- captions
- photographer attribution
- image types

---

## Observation

Render selected structured metadata:

- sex
- life stage
- habitat
- microhabitat
- behavior
- elevation

Hide empty fields.

---

## Location

Map only when public location data permits.

Never reveal hidden coordinates.

---

## Identification

Show:

- current identification
- identifier
- evidence level
- remarks if appropriate

A collapsible or subtle professional section may expose identification history.

---

## Specimen

Only render if applicable.

---

## Related observations

Show a restrained selection from:

- same taxon
- same trip
- same place

Do not implement social-feed recommendation algorithms.

---

# 30. Species pages

Species pages are aggregation views.

They should NOT look like encyclopedia entries.

Suggested layout:

```text
Scientific name
Chinese name if available

N observations
Places represented within this project
```

Then:

## From the field notes

Optional owner-authored personal summary.

Example tone:

> I usually encounter this species on broad leaves along forest edges...

This content is personal natural history, not authoritative species monography.

---

## Observations

Photo-forward observation grid.

---

## Where we found it

Map derived only from PUBLIC observation location data.

Include a clear disclaimer:

> Records shown here represent observations documented on this website and should not be interpreted as the complete distribution of the species.

---

## Identification notes

Optional professional text.

---

## Similar species

Optional curated links.

---

## Taxonomic notes

Only when useful.

Do not automatically fill pages with empty headings.

---

# 31. Trips pages

Trips are a major part of the site's personality.

Example:

```text
Xishuangbanna
July 2026
```

Trip page should include:

- large landscape/habitat hero
- date range
- narrative
- selected field photos
- observation timeline
- observed taxa
- map when appropriate

The experience should resemble a modern naturalist's field journal.

Not a table of sampling sites.

---

# 32. Places page

Provide a visual geographic way to browse observations.

Potential entry levels:

- province
- broad locality
- map

Do not imply sampling completeness.

For privacy-sensitive sites, use only generalized public coordinates.

---

# 33. Search

Provide one unified search experience.

Search may return:

```text
Observations
Species
Trips
Contributors
Places
```

Queries may include:

```text
Siler
察隅
西藏
Tao
forest
2026
```

Do not build a highly complex faceted biodiversity search in MVP.

Useful filters for observations:

- taxon
- contributor
- province
- date
- sex
- life stage
- habitat
- trip

---

# 34. Field Studio

Authenticated management interface route:

```text
/studio
```

Name the interface:

Field Studio

Avoid exposing an ugly `/admin` aesthetic publicly.

Studio navigation:

```text
Dashboard
Observations
Submissions
Trips
Species
Media
Contributors
Settings
```

---

# 35. Studio Dashboard

Owner/editor dashboard should surface actionable work:

```text
Submissions awaiting review
Revision requested
Approved but unpublished
Unidentified observations
Sensitive records
Recent contributor activity
```

Do not create vanity analytics.

---

# 36. Review workflow

Review page should make it easy to compare:

LEFT / TOP:

- photographs
- EXIF suggestions
- contributor note

RIGHT / BOTTOM:

- editable metadata
- identification tools
- location visibility
- media visibility
- specimen fields
- review action

Actions:

```text
Start review
Request revision
Approve
Publish
Reject
Archive
```

Require a reason/message for revision requests.

---

# 37. Visual design direction

The public site should feel like:

> natural-history photography magazine × field notebook

NOT:

> government biodiversity database

NOT:

> SaaS dashboard

NOT:

> generic Tailwind landing page

Visual priorities:

```text
Photography
↓
Place + time
↓
Identification
↓
Narrative
↓
Metadata
```

Use:

- generous white space
- restrained natural palette
- elegant serif/sans pairing
- large images
- subtle borders
- minimal shadows
- quiet animation
- editorial typography

Avoid:

- excessive gradients
- glassmorphism
- neon colors
- huge rounded SaaS cards everywhere
- pointless animations
- dashboard-style statistics on public pages

---

# 38. Responsive design

Mobile is mandatory.

Most observation browsing and contributor uploads should work comfortably on phones.

Test at minimum:

```text
375 px
768 px
1280 px
1440 px
```

Photo upload flow must be mobile usable.

---

# 39. Accessibility

Implement sensible accessibility:

- semantic HTML
- keyboard navigation
- form labels
- alt text
- visible focus states
- sufficient contrast
- accessible dialogs/lightboxes
- reduced motion support where applicable

---

# 40. Performance

Public photography pages must remain fast.

Implement:

- responsive image sizing
- lazy loading below fold
- optimized derivatives
- caching
- server rendering where useful
- pagination / infinite loading only where justified

Do not serve full-resolution originals in observation grids.

---

# 41. Security

Treat all contributor input as untrusted.

Implement:

- server-side validation
- file MIME validation
- size limits
- safe filenames/storage keys
- authorization checks on every mutation
- RLS
- CSRF-safe framework patterns
- output sanitization for rich text
- upload rate limits where practical

Never rely solely on hidden UI buttons for authorization.

---

# 42. Public-data security test

Explicitly test that a visitor cannot access:

- drafts
- submitted observations
- exact coordinates of blurred records
- hidden coordinates
- private media
- embargoed media
- contributor-only Studio APIs

Test URLs and APIs directly.

---

# 43. Privacy architecture requirement

Create separate public DTO/query paths.

For example:

```text
getPublicObservation()
```

must only select fields safe for public rendering.

Do NOT:

```text
SELECT *
```

and delete sensitive keys later in a React component.

Security must begin at query/service layer.

---

# 44. Taxonomy architecture requirement

Never write code like:

```text
observation.species = "Siler cupreus"
```

Authoritative taxonomic state must flow through:

```text
Observation
↓
Identification
↓
Taxon
```

Species pages query current identifications.

---

# 45. Free text vs controlled vocabulary

Use controlled values for:

- sex
- life stage
- identification evidence
- observation status
- location visibility
- media visibility
- media view type

Use free text for:

- field note
- taxonomic remarks
- habitat notes
- behavior notes
- trip narrative

Do not create an uncontrolled tag system in MVP.

---

# 46. Suggested enums

## sex

```text
male
female
unknown
mixed
not_applicable
```

## life_stage

```text
adult
subadult
juvenile
unknown
mixed
```

## visibility

```text
private
public
embargoed
```

Adapt as required but document any change.

---

# 47. Data portability

Core scientific information must not become trapped in the frontend.

Prepare export architecture for:

- CSV
- JSON

Future compatibility may include Darwin Core, but do not make Darwin Core a visible product priority during MVP.

At minimum design the schema so these fields can map reasonably to:

```text
eventDate
decimalLatitude
decimalLongitude
stateProvince
county
locality
minimumElevationInMeters
scientificName
sex
lifeStage
recordedBy
identifiedBy
occurrenceID
catalogNumber
```

---

# 48. Backups

Document backup strategy.

At minimum:

Database:
- automated database backups

Media:
- storage durability/versioning plan

Periodic portable export:
- observations
- identifications
- taxa
- locations
- media metadata
- specimens

The website must never be the sole irreplaceable copy of field data.

---

# 49. Repository structure

Use a clean structure approximately like:

```text
app/
  observations/
  species/
  trips/
  places/
  contributors/
  studio/
  api/

components/
  observation/
  species/
  trip/
  media/
  map/
  forms/
  studio/
  ui/

lib/
  auth/
  database/
  permissions/
  media/
  taxonomy/
  validation/
  privacy/

database/
  migrations/
  seeds/

content/
  about/
  guides/

tests/

scripts/

docs/
```

Adjust where Next.js conventions require, but preserve separation of concerns.

---

# 50. Database migration policy

All schema changes require migrations.

Never modify production schema manually as the canonical change.

Use versioned migrations, for example:

```text
20260906_create_observations.sql
20260906_create_identifications.sql
20260908_add_location_visibility.sql
```

Migration files belong in Git.

---

# 51. Git workflow

Branches:

```text
main
develop

feature/*
fix/*
refactor/*
```

Examples:

```text
feature/observation-upload
feature/contributor-invitations
feature/trip-pages
fix/public-coordinate-leak
```

Use Conventional Commits:

```text
feat: add contributor observation submission
fix: prevent exact coordinates from public queries
refactor: separate identification from observations
docs: document media privacy model
test: add contributor permission tests
```

---

# 52. AGENTS.md

Create an `AGENTS.md` at project root containing non-negotiable rules.

At minimum include:

```text
1. Never change the database schema without a migration.

2. Never expose protected exact coordinates through public queries, APIs, metadata, image EXIF, logs, or client-side state.

3. Never modify original uploaded images.

4. Never allow contributors to publish directly.

5. Never hard-code authoritative scientific names into observation records.

6. Every authoritative identification must reference a taxon record.

7. Observation identity and URLs must remain valid when taxonomy changes.

8. Unknown or uncertain identifications are valid records.

9. Do not add public registration.

10. Do not add comments, likes, follows, leaderboards, forums, or social-network features unless explicitly requested.

11. Do not turn this project into a complete Chinese Salticidae database.

12. Do not bulk-import national/global taxonomic catalogs unless explicitly requested.

13. Prioritize photography and field-note readability over database-style UI.

14. Public species maps show only records from this project and never imply complete distributions.

15. Privacy and biological locality protection override visual convenience.

16. Every significant mutation must enforce authorization server-side.

17. Do not expose secrets or service-role credentials to the client.

18. New features must include loading, empty, success, and error states.

19. Avoid speculative architecture for hypothetical massive scale.

20. Build only the feature currently required, while preserving the documented domain model.
```

---

# 53. Testing requirements

Do not chase meaningless 100% coverage.

Prioritize high-risk functionality.

## Permissions tests

Contributor:

```text
can create own draft → yes
can edit own draft → yes
can view own submission → yes
can edit another contributor record → no
can publish → no
can modify taxonomy → no
can access protected coordinates → no
```

Visitor:

```text
published record → yes
draft → no
submitted record → no
private media → no
exact coordinate of blurred observation → no
```

Owner:

expected full access.

---

## Media tests

Test:

- valid JPG
- PNG
- HEIC if supported
- invalid executable renamed as image
- oversized file
- corrupted image
- multiple upload
- duplicate upload behavior
- EXIF date
- EXIF GPS
- derivative generation
- stripped GPS metadata

---

## Taxonomy tests

Test:

```text
Observation created without identification
↓
tentative genus ID
↓
species ID
↓
identification changed again
```

Observation public ID and URL must remain unchanged.

---

# 54. Definition of Done

No feature is complete merely because the UI appears to work.

Every feature must satisfy:

```text
[ ] UI implemented
[ ] mobile layout checked
[ ] server-side validation
[ ] authorization verified
[ ] privacy implications reviewed
[ ] migration included if schema changed
[ ] loading state
[ ] empty state
[ ] error state
[ ] TypeScript passes
[ ] lint passes
[ ] production build passes
[ ] relevant tests pass
[ ] tested with realistic observation data
[ ] documentation updated
```

---

# 55. MVP scope

DO build:

## Public

```text
Home
Observation browser
Observation detail
Species browser
Species aggregation page
Trips
Trip detail
Places/map
Contributors
About
```

## Account

```text
Login
Invitation acceptance
Profile
```

## Contributor

```text
New Observation
Drafts
Submissions
Revision workflow
```

## Field Studio

```text
Dashboard
Submission review
Observation editor
Identification management
Taxon management
Trip management
Contributor management
```

---

# 56. Explicitly out of scope for MVP

Do NOT implement:

```text
public registration
comments
likes
followers
direct messages
forums
user rankings
observation rankings
gamification
public identification voting
AI species identification
automatic authoritative species identification
complete Chinese Salticidae checklist
GBIF synchronization
World Spider Catalog synchronization
mobile native application
social feed
complex analytics dashboard
public API
real-time chat
notifications beyond what is necessary for submission workflow
```

Do not create placeholder architecture for all of these.

---

# 57. Implementation order

Work in the following order.

Do not jump directly into visual polish.

## Phase 1 — Repository foundation

Set up:

- Next.js
- TypeScript
- Tailwind
- Supabase client architecture
- environment validation
- linting
- formatting
- basic test framework
- GitHub-ready repository

Create:

- README.md
- AGENTS.md
- `.env.example`

---

## Phase 2 — Database model

Implement migrations for:

```text
profiles
invitations
observations
observation_people
locations
media
taxa
identifications
trips
trip_observations
specimens
audit_logs
site_settings
```

Implement constraints and indexes.

Implement RLS.

Write documentation describing relationships.

Do not move on until role permissions make sense.

---

## Phase 3 — Authentication and invitation

Implement:

```text
Owner invite
↓
Invitation token
↓
Contributor account
↓
Contributor profile
```

No public signup.

---

## Phase 4 — Observation core

Implement:

```text
Create draft
Edit draft
Observation list
Observation detail
```

Use realistic seeded observations.

Do not rely entirely on lorem ipsum.

---

## Phase 5 — Media pipeline

Implement:

```text
upload
preview
EXIF
metadata confirmation
storage adapter
derivatives
sorting
cover selection
captions
privacy
```

---

## Phase 6 — Contributor workflow

Implement end-to-end:

```text
Contributor login
↓
New observation
↓
Save draft
↓
Submit
↓
Owner review
↓
Revision or approval
↓
Identification
↓
Publish
```

This closed loop is the most important MVP milestone.

---

## Phase 7 — Species aggregation

Build species pages from published observation + current identification data.

Do not manually duplicate observation data into species records.

---

## Phase 8 — Trips

Implement curated field journal pages.

Make these visually distinctive.

---

## Phase 9 — Places and map

Build public maps exclusively from public-safe location queries.

Verify coordinate privacy before release.

---

## Phase 10 — Search

Implement simple, useful unified search.

Avoid overengineering.

---

## Phase 11 — Visual refinement

Only now refine:

- typography
- spacing
- image presentation
- interaction
- transitions
- mobile polish
- empty states

---

## Phase 12 — Production hardening

Verify:

```text
authorization
RLS
coordinate privacy
EXIF privacy
private media
error handling
backups
database migration workflow
storage configuration
build
deployment
```

---

# 58. Initial seed/demo content

Create realistic but clearly marked DEVELOPMENT seed data.

Use taxa such as:

```text
Siler cupreus
Siler collingwoodi
Siler semiglaucus
Phintella sp.
Chrysilla sp.
Salticidae sp.
```

Include examples of:

- male
- female
- juvenile
- unknown identification
- tentative identification
- genitalia-confirmed identification
- blurred location
- locality-only record
- unpublished draft
- contributor submission
- published observation
- trip-associated observations

Do not fabricate these as real-world scientific records in production.

They are development fixtures only.

---

# 59. Homepage copy style

Avoid corporate language such as:

```text
Explore our comprehensive biodiversity database.
```

Prefer personal natural-history language such as:

```text
A field notebook of jumping spiders encountered across China.
```

Chinese:

```text
记录我们在中国各地与跳蛛相遇的时刻。
```

The site's tone should be:

- quiet
- curious
- precise
- personal
- scientifically responsible

---

# 60. Writing conventions

Scientific names:

- italicized in UI
- genus capitalized
- species lowercase

Examples:

```text
Siler cupreus
Phintella sp.
Siler cf. cupreus
```

Do not italicize:

```text
sp.
cf.
aff.
```

when typographically practical.

Dates should support localization.

Chinese and English architecture should remain internationalization-friendly even if MVP initially emphasizes Chinese.

Do not hard-code long UI strings across components.

---

# 61. Public disclaimer

Include an unobtrusive statement in About and relevant species/location pages:

> China Salticid Field Notes is a personal, curated natural-history project. Records presented here reflect observations documented by the project owner and invited contributors and should not be interpreted as a complete checklist or complete distribution dataset for Chinese Salticidae.

Provide a Chinese version.

---

# 62. Quality bar

The result should feel like a real product that a researcher could maintain for more than ten years.

Favor:

- simple durable models
- strong privacy boundaries
- clean code
- editable content
- photographic presentation
- scientific traceability

over:

- flashy demos
- speculative features
- unnecessary abstractions
- dashboard clutter

---

# 63. Before coding any feature

For every substantial feature:

1. Inspect the existing repository.
2. Understand the current domain model.
3. Identify affected permissions.
4. Identify privacy implications.
5. Identify schema impact.
6. Reuse existing patterns when sound.
7. Implement the smallest complete solution.
8. Test the real workflow.
9. Update documentation.

Do not rewrite unrelated modules.

Do not silently change architectural conventions.

---

# 64. When requirements are ambiguous

Choose the option that best preserves these priorities:

```text
scientific record integrity
>
privacy
>
maintainability
>
personal editorial character
>
ease of contributor submission
>
feature richness
```

Do not expand the project scope without explicit instruction.

---

# 65. Final product identity

At all times remember:

This is NOT:

> a database of jumping spiders in China.

It IS:

> a long-term, curated digital field notebook documenting the jumping spiders that we actually encountered.

The conceptual hierarchy is:

```text
OBSERVATION
I encountered a spider.

TRIP
I went somewhere and experienced a place.

SPECIES
What these accumulated encounters taught us about a taxon.
```

All architecture and UI should reinforce this hierarchy.

---

# 66. Start now

Begin by inspecting the current repository.

If this is an empty repository:

1. initialize the application;
2. create `README.md`;
3. create `AGENTS.md`;
4. create `.env.example`;
5. establish the project structure;
6. implement the first database migrations;
7. implement authentication architecture;
8. build the smallest usable Observation workflow.

Do not spend the first iteration polishing the homepage.

The first major milestone is:

> An invited contributor can create an observation, upload photographs, submit it, and the owner can review, identify, and publish it without exposing protected information.

After each implementation stage:

- run tests
- run type checking
- run lint
- run production build
- fix failures before continuing

Do not merely describe what should be done.

Implement it.
