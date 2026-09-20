# Wheelhouse Release 1 — screen review

Reviewed screens: 84 of 84
Review issue: https://github.com/JackCurphey/wheelhouse-epos/issues/50

## 01 / Choose a service (`service`)

**Decision:** General note

I think if theres going to be three options on this page, which i like, it should lead you to another page with more detialed options,  for example the 3 options are "Whole service" "individual service" and "not sure" or something along those lines, and if you click on individual service the next page has a list of the individual services for you to chose from.

Implementation package: P03 · P05

## 02 / Describe the bike & problem (`problem`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P03 · P05

## 03 / Choose drop-off or appointment (`date`)

**Decision:** General note

I think it should be the shop setting that decide whether they have drop off day or exact appointment, some shops will want to do drop off day only, some will want to do exact appointment only

Implementation package: P04 · P05

## 04 / Contact & update preferences (`details`)

**Decision:** General note

I think it might be worth adding the option for shops to add a deposit option that works the same as it does at tallboys (mark will understand if claude is reading this)

Implementation package: P05 · P06

## 05 / Request received (`pending`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P04 · P05

## 06 / Review incoming requests (`requests`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02 · P04 · P05

## 07 / Confirm the request (`review`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P04 · P05

## 08 / Booking confirmed (`confirmed`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P04 · P05 · P06

## 09 / The workshop at a glance (`desk`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02 · P04

## 10 / Book the bike into the shop (`intake`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02 · P08

## 11 / Print & attach the bike tag (`print`)

**Decision:** General note

I think instead of a qr code, it should just be a barcode scanner. Also i would like the shop to be able to choose in settings what the main thing at the top of the tag shows, either the job number, customer name or what bike it is. Certain shops use different things to identify bikes at a glance

Implementation package: P08

## 12 / Scan → authenticated job (`scan`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P01 · P02 · P08

## 13 / Create a walk-in job (`new-job`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02 · P04

## 14 / The complete job workspace (`job`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02

## 15 / Audit changes to the job (`history`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02

## 16 / Full paper job card (`job-card`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P08

## 17 / Open the mechanic’s job (`mechanic`)

**Decision:** General note

Once again, i would like it all to be either tablet or browser based, I dont want it to be mainly phone based, but i guess we can add that as an option

Implementation package: P02 · P03

## 18 / Inspect & explain the findings (`inspection`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02 · P03 · P05

## 19 / Build the itemised quote (`quote-editor`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P03

## 20 / Send the approval request (`quote-send`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P03 · P05 · P06

## 21 / Approve each line (`approval`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P03 · P05

## 22 / Know what was agreed (`approval-done`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P03 · P05

## 23 / Shop sees the exact agreement (`approved`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02 · P03 · P04

## 24 / Find parts, SKUs & labour (`catalogue-search`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02 · P03 · P07

## 25 / Allocate work in the diary (`diary`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P04

## 26 / Take work from the shared queue (`queue`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02 · P04

## 27 / Do the approved work (`working`)

**Decision:** General note

I think for full jobs like general services, a shop should be able to make a checklist template that shows what they do in a service so the mechanic can 1. make sure they do everything but also 2. show the customer everything that was checked without the mechanic having to explicitly write it all out

Implementation package: P02 · P03

## 28 / Handle a parts delay (`waiting`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02 · P04 · P06

## 29 / One job conversation (`inbox`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P06

## 30 / Customer follows up (`customer-message`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P05 · P06

## 31 / Handoff agreed work to Lightspeed (`pos`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P00 · P07

## 32 / See the linked work order (`pos-done`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P07

## 33 / Finish, check, then mark ready (`finish`)

**Decision:** General note

I dont think there should be a mechanic phone view, i think it should all be done on either a desktop or tablet, but just one page for the job, that can incorporate the "finish check and mark ready" section. A mechanic will have to scan items in to a job and everything which i think should just all be on one page

Implementation package: P02 · P03 · P06

## 34 / Customer is invited to collect (`ready`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02 · P05 · P06

## 35 / Record physical collection (`collection`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02 · P07

## 36 / Collected, with a durable history (`closed`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02

## 37 / Return to the private progress link (`progress`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02 · P05 · P06

## 38 / Week view of workshop capacity (`week`)

**Decision:** General note

I think the week view should look like the one i had made. Also a small thing would be being able to right click on day, week or month and be able to set that as the default for when you click on diary. Some shops might always look at only the day view, whereas some will only look at the week view

Implementation package: P04

## 39 / Month view and closed days (`month`)

**Decision:** General note

I think the month overview should show the words "full" or "space available", but have the boxes coloured so you can see at a glance how the month is looking

Implementation package: P04

## 40 / Work finished; prepare the handover (`finished`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02 · P07

## 41 / Mechanic’s job conversation (`mechanic-message`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02 · P06

## 42 / “I don’t know what’s wrong” (`diagnosis`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P03 · P05

## 43 / Triage an unknown problem (`diagnosis-review`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P03 · P04 · P05

## 44 / Book an exact appointment (`appointment`)

**Decision:** General note

I think both the drop off day and choose appointment should show a calender view of the diary with already filled slots blurred out, like i had in the version i created. Or even give shops an option between the two for full customisation

Implementation package: P04 · P05

## 45 / Explain unavailable dates (`full`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P04 · P05

## 46 / Change or cancel a booking (`reschedule`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P04 · P05

## 47 / Date change is pending (`change-pending`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P04 · P05

## 48 / Confirm a cancellation (`cancel`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P04 · P05

## 49 / Cancellation acknowledged (`cancelled`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02 · P04 · P05

## 50 / Decline with an explanation (`reject`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P04 · P05 · P06

## 51 / Customer sees a declined request (`rejected`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P05 · P06

## 52 / Expired request / private link (`expired`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P01 · P04 · P05

## 53 / A quote changed before approval (`stale`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P03 · P05

## 54 / Agree a spending ceiling (`ceiling`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P03 · P05

## 55 / A diary move cannot be saved (`capacity-conflict`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02 · P04

## 56 / Another mechanic claimed it (`claim-conflict`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02 · P04

## 57 / Uncertain Lightspeed handoff (`pos-unknown`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P07

## 58 / Printer offline / output unknown (`print-error`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P08

## 59 / Deliberately reprint a tag (`reprint`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P08

## 60 / A message needs attention (`message-error`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P06

## 61 / Sign in after scanning (`login`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P01 · P08

## 62 / Wrong shop or revoked access (`denied`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P01

## 63 / Reopen without rewriting history (`reopen`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P01 · P02

## 64 / Change customer update channels (`preferences`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P05 · P06

## 65 / Booking service temporarily unavailable (`service-status`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P05 · P10

## 66 / Shop identity & booking appearance (`settings`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P05 · P09

## 67 / Service catalogue & questions (`services`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P03

## 68 / Configure a service (`service-edit`)

**Decision:** General note

Inspection checklist should be editable. Amount of customer questions should be editable, some shops might want many, some just one

Implementation package: P03

## 69 / Hours, leave & available effort (`hours`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P04

## 70 / Set booking & diary behaviour (`booking-settings`)

**Decision:** General note

3rd option for booking mode, appointment only

Implementation package: P04 · P05 · P09

## 71 / Connect email, SMS & WhatsApp (`message-settings`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P00 · P06

## 72 / Configure a messaging channel (`channel-edit`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P00 · P06

## 73 / Verify delivery before enabling (`channel-proof`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P00 · P06

## 74 / Edit a customer message template (`template`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P06 · P09

## 75 / Connect the one chosen Lightspeed (`connect`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P00 · P07

## 76 / Verify connector capabilities (`connect-proof`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P00 · P07

## 77 / Register printers & scan a fixture (`printer-settings`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P00 · P08

## 78 / Manage staff access (`staff-settings`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P01

## 79 / Change or deactivate access (`staff-edit`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P01

## 80 / Confirm staff deactivation (`staff-deactivate`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P01

## 81 / Customer & bike records (`customers`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02

## 82 / Edit a customer and bike (`customer-record`)

**Decision:** General note

Should be bike dropdown as a customer might have multiple bikes

Implementation package: P02

## 83 / Review a possible duplicate (`duplicates`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P02

## 84 / A clear save confirmation (`setup-saved`)

**Decision:** Approved as shown

_Approved without an additional note._

Implementation package: P01 · P09
