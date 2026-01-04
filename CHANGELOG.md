# CHANGELOG

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-01-04

### Added

- Ability to search app by Steam store url (in addition of using app ID)

### Removed

- Ability to search app by name, due to Steam deprecating a core API endpoint supporting this feature

## [1.2.0] - 2025-06-29

### Added

- Option to hide currency label, to unclutter UI for long currency codes

## [1.1.0] - 2024-10-27

### Added

- Release date info for unreleased games

### Fixed

- Some games occasionally not found using the app ID number
- Unreleased games with no price set yet incorrectly shown as Free

## [1.0.0] - 2024-09-17

First release of Steam Price Tracker. The plugin displays the current price of any Steam app. Keep track of discounts and don't miss out on a bargain!

- Automatically updates info every hour.
- Press key to go to the Steam Store app page.
- Long press key to force an update of all visible apps.
