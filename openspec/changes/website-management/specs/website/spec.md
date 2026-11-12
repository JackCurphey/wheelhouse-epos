# Spec Delta

## Purpose

Office › Website is where a shop puts its website up and keeps it right: the
words and photos, the logo and colour, tracking tools, and whether it is
Wheelhouse's website or the shop's Shopify shop. Changes wait as a draft
until the shop publishes them.

## ADDED Requirements

### Requirement: A shop sets up its website in three steps

Before the website is set up, Office › Website SHALL open "SET UP YOUR WEBSITE · STEP 1 OF 3": "Wheelhouse's website, or your Shopify shop?", "You can change this later.", with the two drawn choices, Not now ("The Website page will say "Not set up yet"") and Next. Choosing Wheelhouse's website SHALL lead to step 2, "Your logo and colour", then step 3, "Start with every product online, or nothing?", ending with Make my website. Choosing Shopify SHALL lead to step 2, "Connect your Shopify shop". Back SHALL return to the step before without losing what was chosen.

#### Scenario: The Owner sets up Wheelhouse's website

- **WHEN** Jack Lewis opens Office › Website for the first time, picks "Wheelhouse's website", presses Next, keeps a colour, presses Next, picks "Every product online" and presses Make my website
- **THEN** the website is made from the shop's details, switched off, and the Website page shows "Your website is off"

#### Scenario: Not now

- **WHEN** the Owner presses Not now on step 1
- **THEN** the Website page says "Not set up yet", and opening it again starts the steps

### Requirement: Step 3 says how many products go online, and which have no photo or price

Step 3 SHALL offer "Every product online" ("Everything with a price shows. Switch off what you don't want online.") and "Nothing online" ("Add categories and products as you go."). With every product online it SHALL show how many products go online, how many have no photo ("shown with their name") and how many have no price ("stay off until priced"), each count with See them, and "Your website stays off until you turn it on." Every product online SHALL switch "Show on website" on for every product with a price; Nothing online SHALL leave every product's switch off. The question SHALL be asked only once.

#### Scenario: Starting with every product online

- **WHEN** the shop has [n] priced products, [n] of them with no photo, and [n] products with no price, and the Owner picks Every product online
- **THEN** step 3 shows "[n] products go online", "[n] have no photo (shown with their name)" and "[n] have no price (stay off until priced)", and Make my website switches "Show on website" on for the priced products only

#### Scenario: See them

- **WHEN** the Owner presses See them beside "have no photo"
- **THEN** Stock opens showing those products

### Requirement: The shop chooses its logo and one main colour, checked for easy reading

Step 2 SHALL show the logo with Change logo, "No logo yet? Skip it — your shop's name is shown instead, and you can add one later.", and "Main colour — for buttons and links" with colours suggested from the logo, Wheelhouse's own Soft sand charcoal #2A2822, and Choose another colour. Every colour offered or chosen SHALL be checked so text on it stays easy to read; a colour that fails SHALL not be accepted and the shop SHALL be told why.

#### Scenario: Colours suggested from the logo

- **WHEN** the Owner adds a logo that is mostly dark blue and green
- **THEN** step 2 offers colours taken from the logo, such as Dark blue #1A3F66 and Green #2F6B4F, as well as Soft sand charcoal #2A2822

#### Scenario: A colour too pale for text

- **WHEN** the Owner chooses another colour that white text on it would be hard to read on
- **THEN** the colour isn't taken, and the step says it would make text hard to read

#### Scenario: No logo

- **WHEN** the Owner presses Next without a logo
- **THEN** the website shows the shop's name where the logo would be

### Requirement: The Website page shows whether the website is on, and what customers see

Office › Website SHALL show "Your website is off" with "Only your staff can see it. Customers will find it at [shop-name].wheelhouseepos.com" and Turn it on, or "Your website is on" with "Customers can see it at [shop-name].wheelhouseepos.com" and Turn off. It SHALL show the summary rows Taking payments, Pages ("Home, About us, Contact us, Collection and returns, Privacy, Cookies"), Tracking tools, Web address ("[shop-name].wheelhouseepos.com · your free address · Wheelhouse sets up your own address for you") and Wheelhouse's website or Shopify, and the footer line pointing to Settings › Front desk › Online orders with Open Online orders settings.

#### Scenario: Website off and payments not connected

- **WHEN** the Owner opens Office › Website with the website off and no payments connected
- **THEN** it shows "Your website is off", Taking payments "Not connected · customers can look but not buy · open to connect [payment provider] · in Settings › Front desk › Online orders", and Tracking tools "None — so there's no cookie choice"

#### Scenario: Website on and payments connected

- **WHEN** the website is on and payments are connected with the test payment done
- **THEN** it shows "Your website is on", Turn off, and Taking payments "Connected to [payment provider] · test payment done · in Settings › Front desk › Online orders"

#### Scenario: Every shop keeps its free address

- **WHEN** any shop's website is on
- **THEN** customers reach it at [shop-name].wheelhouseepos.com

### Requirement: The first Turn it on also publishes

While the website has never been published, Turn it on SHALL say "This also publishes your website as it is now. Customers can look but not buy until you connect payments.", list any parts still holding their starting wording, and show how many products go online and how many have no photo or no price. Pressing it SHALL publish the draft and switch the website on together. Turn off SHALL hide the website from customers without changing what is published.

#### Scenario: Turning it on for the first time

- **WHEN** the Owner presses Turn it on and the website has never been published
- **THEN** the draft is published, customers can see the website, and the page shows "Your website is on"

#### Scenario: Starting wording is named before turning on

- **WHEN** Collection and returns and Privacy still hold their starting wording
- **THEN** Turn it on says "2 pages still have starting wording: Collection and returns, Privacy"

#### Scenario: Turning it off

- **WHEN** the Owner presses Turn off
- **THEN** customers no longer see the website, and turning it on again shows the same published version

### Requirement: The Words and photos list edits each fixed part

The Website page SHALL show a Words and photos list with one row per fixed part — Headline, A line about the shop, The big photo, The workshop's words, The shop's own words and photo, Collection and returns, Privacy — each with Edit opening a form box for that part's words, or its photo with a description. A part still holding its starting wording SHALL say "Check this" until it is saved once. Saving a part SHALL change the draft only.

#### Scenario: Editing the headline

- **WHEN** the Owner presses Edit on Headline, changes the words and saves
- **THEN** the draft holds the new headline, customers still see the published one, and "Edit words and photos" shows one more unpublished change

#### Scenario: Checking the starting wording

- **WHEN** Privacy says "Check this" and the Owner opens it and saves it, changed or not
- **THEN** Privacy no longer says "Check this"

#### Scenario: Two people change different parts

- **WHEN** one Owner saves the Headline while another saves Collection and returns
- **THEN** both changes are in the draft

### Requirement: A photo has a description, or is marked as decoration

The form box for a part with a photo SHALL ask for a description of the photo, with "This photo is only decoration" as the other choice. A photo with neither SHALL be counted in the unpublished changes as "1 photo has no description. Add it", which opens that part.

#### Scenario: A photo with no description

- **WHEN** the Owner saves The big photo with a new photo and no description
- **THEN** the list of unpublished changes shows "1 photo has no description. Add it"

#### Scenario: A decoration photo

- **WHEN** the Owner ticks "This photo is only decoration"
- **THEN** the photo is not counted as missing a description, and customers' screen readers skip it

### Requirement: The Website page opens the list of unpublished changes, with Publish and Discard

When the draft differs from what is published, "Edit words and photos" SHALL show "[n] unpublished changes" and "Saved by [person] [time] · customers see them when you publish", and the page SHALL open the list of unpublished changes: each page with what changed on it, any photos with no description, Publish and Discard changes. "Review in the editor" SHALL stay hidden until the editor exists. With no unpublished changes it SHALL say "Not published yet" before the first publish, and show no list after.

#### Scenario: Three unpublished changes

- **WHEN** Jack Lewis has changed the Home page headline and the Collection and returns text since the last publish
- **THEN** the Website page opens with "3 unpublished changes", listing "Home page" and "Collection and returns" with what changed, and Publish and Discard changes

### Requirement: Publish makes the draft what customers see

Publish SHALL make the draft the published version and keep the version it replaces in History. With the website on it SHALL say "Published — customers see it now" with View website; with the website off, "Published. Customers will see it once you turn the website on" with View it. Customers SHALL only ever see the published version.

#### Scenario: Publishing while on

- **WHEN** the website is on and the Owner presses Publish
- **THEN** customers see the changes, the toast says "Published — customers see it now", and the list of unpublished changes closes

#### Scenario: Publishing while off

- **WHEN** the website is off and the Owner presses Publish
- **THEN** the toast says "Published. Customers will see it once you turn the website on"

#### Scenario: Customers never see the draft

- **WHEN** the draft has unpublished changes
- **THEN** the customer website shows the published version only

### Requirement: Discard goes back to the last published version, and nothing is lost

Discard changes SHALL ask first: "Discard your [n] unpublished changes?", "Changes saved since you last published, on [date]", the list of changes, and "Your website goes back to the last published version. The changes are kept in History for [n] days, in case you want them back.", with Keep editing and Discard changes. Discarding SHALL put the draft back to the published version and keep the discarded draft in History.

#### Scenario: Discarding

- **WHEN** the Owner presses Discard changes, then Discard changes in the box
- **THEN** the draft matches the published version, and the discarded draft is in History

#### Scenario: Keep editing

- **WHEN** the Owner presses Keep editing
- **THEN** the box closes and the draft is unchanged

### Requirement: History lists earlier versions, with Go back to this

History SHALL open over the Website page: "Earlier versions", "Published versions, and drafts you discarded in the last [n] days" (with [n] as 90; History keeps 90 days). Each row SHALL show its date and time, whether it was published or a discarded draft, who by, and what changed; the current published version SHALL say "What customers see now"; the first SHALL say "First published". Other rows SHALL have View and Go back to this. Going back SHALL put that version in the draft as unpublished changes ("Check it, then press Publish."); with unpublished changes already there it SHALL first say "Going back replaces them — they're kept here, so you can come back to them." and keep them in History. Versions older than [n] days, other than the published one, SHALL be removed.

#### Scenario: Going back to a discarded draft

- **WHEN** the Owner opens History and presses Go back to this on an unpublished draft discarded by Jack Lewis
- **THEN** that draft becomes the unpublished changes, and customers still see the published version until Publish

#### Scenario: Going back keeps the current changes

- **WHEN** there are 3 unpublished changes and the Owner goes back to an earlier version
- **THEN** the 3 changes are kept in History as a discarded draft

### Requirement: Tracking tools are chosen from a list, and wait for Publish and for the customer

Website › Tracking tools SHALL list Google Analytics and Microsoft Clarity (Statistics) and Meta (Facebook) Pixel and TikTok Pixel (Marketing), each Off, with no place to paste code. Switching a tool on SHALL ask for its ID; an ID that doesn't look right SHALL show the drawn error and the tool SHALL wait, with no cookie choice and nothing loading. A tool SHALL go live only when the website is published, and load only for customers who say yes to its kind. With no tool on, the website SHALL use only the cookies it needs and give customers no cookie choice. Switching a tool off SHALL keep its ID.

#### Scenario: Switching Google Analytics on

- **WHEN** the Owner switches Google Analytics on and types an ID starting "G-"
- **THEN** the page says "When you publish, your website will ask customers about cookies. Google Analytics only loads for customers who say yes to "Statistics". Every page's footer gains "Cookie choices".", and the toast says "Google Analytics on · goes live when you publish" with Undo

#### Scenario: A wrong ID

- **WHEN** the Owner types a Google Analytics ID that doesn't start "G-"
- **THEN** it says "That doesn't look like a Google Analytics ID. It starts with G- and is in your Google Analytics settings." and "Waiting for a correct ID — until then, no cookie choice and nothing loads."

#### Scenario: Off keeps the ID

- **WHEN** the Owner switches a tool off and on again
- **THEN** its ID is still there

### Requirement: A shop can keep its Shopify shop, with Wheelhouse in charge

Connecting Shopify SHALL show the drawn "What happens" list and "Your Shopify address", and Connect SHALL open Shopify to approve, then come back with nothing sent. Before sending, it SHALL show "Ready to send to Shopify" with how many products get new prices, new photos, new stock levels and are added, and the products only in Shopify, with See the list of products, "Send [n] products" and Not now. Sending SHALL show "[n] of [n] products sent. You can leave this page — it carries on." Products that couldn't be sent SHALL each show why, with Fix in Stock, and Try sending again. If Shopify can't be found or the approval is cancelled, it SHALL say "Couldn't connect…" and nothing SHALL change.

#### Scenario: Connecting and sending

- **WHEN** the Owner types [your-shop].myshopify.com, approves in Shopify, checks the counts and presses Send [n] products
- **THEN** the products are sent, and the Website page shows "Connected to your Shopify shop" with when it last sent and how many products

#### Scenario: Products only in Shopify are left alone

- **WHEN** the shop's Shopify has products that aren't in Wheelhouse
- **THEN** "Ready to send to Shopify" lists them under See the list of products, and sending leaves them in Shopify as they are

#### Scenario: Connecting fails

- **WHEN** Shopify doesn't find the address, or the approval is cancelled
- **THEN** it says "Couldn't connect. Shopify didn't find [your-shop].myshopify.com, or the approval was cancelled. Nothing has changed."

#### Scenario: A product can't be sent

- **WHEN** a product has no price yet
- **THEN** the problems list shows it with "No price yet" and Fix in Stock

### Requirement: Connected to Shopify, the Website page shows what's sent and can switch back

With Shopify connected, the Website page SHALL show "Connected to your Shopify shop" with the address, when it last sent, how many products, Pause sending and Open Shopify, the drawn rows, "sent as you change them in Wheelhouse", and "Change products, prices and stock here in Wheelhouse — changes to them made in Shopify are replaced. Your Shopify theme, pages, cookies and tracking are set in Shopify." "Switch to Wheelhouse's website" SHALL ask first, with the drawn list of what happens; Switch SHALL stop sending, make Wheelhouse's website switched off for the shop to check, and keep the web address, orders and "Show on website" switches.

#### Scenario: A change in Wheelhouse goes to Shopify on its own

- **WHEN** a product shown online is sold at the till, its stock or price or photo changes, or a bike of it is held
- **THEN** the change reaches Shopify within a minute or so with nothing pressed, and a change Shopify can't take is listed with why

#### Scenario: Pausing

- **WHEN** the Owner presses Pause sending
- **THEN** nothing more is sent to Shopify until sending is resumed

#### Scenario: Switching back

- **WHEN** the Owner presses Switch in "Switch to Wheelhouse's website?"
- **THEN** Wheelhouse stops sending to Shopify, Wheelhouse's website is made switched off, and orders already placed on Shopify stay in Online orders

### Requirement: Only people who can edit the website see it

Until roles are built, only an Owner SHALL change the website. Website SHALL not be in the sidebar for anyone else. Someone else who opens it by a link SHALL see "Only some people can change the website", "People with "Can edit the website" can change it: [names]. Ask them if something needs changing." and Back to Today. Once roles are built, "Can edit the website" SHALL decide this; payments SHALL also need "Can change settings" and connecting Shopify SHALL need both, with someone who has only the first seeing the page without its settings rows and "What the website sells and online payments are in Settings, which you can't change. Ask [names]."

#### Scenario: Staff follow a link

- **WHEN** Jo Taylor, Staff, opens Office › Website
- **THEN** Jo sees "Only some people can change the website" naming Jack Lewis, and Back to Today

#### Scenario: Staff sidebar

- **WHEN** Jo Taylor signs in
- **THEN** Website is not in Jo's sidebar

#### Scenario: The server refuses too

- **WHEN** someone who isn't an Owner sends a change to the website directly
- **THEN** it is refused and nothing changes

### Requirement: The website is ready once every starting wording is checked

The website SHALL count as ready when it is set up and no part still holds its starting wording; Getting started and the move's switch-over checklist SHALL tick "the website is ready" on this rule. While a shop is moving from Citrus Lime, the Website page SHALL say the website goes on during switch-over morning, from the switch-over checklist, with "Ready for switch-over · [n] of 2" and what's done and to do; on switch-over morning it SHALL say "Your website is ready" and "Switch-over morning: turn your website on now. This also publishes it as it is now."

#### Scenario: Not ready yet

- **WHEN** the website is set up and Collection and returns and Privacy still say "Check this"
- **THEN** the website is not ready, and while moving the page shows "1 of 2" with "To do: 2 pages still have starting wording"

#### Scenario: Ready

- **WHEN** both have been saved
- **THEN** the website is ready, and the rows no longer say "Check this"
