# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).



## [0.45.5](https://github.com/rokucommunity/brs/compare/v0.45.4...v0.45.5) - 2024-03-28
### Added
 - implemented `roString` methods `startsWith()` and `endsWith()` ([#44](https://github.com/rokucommunity/brs/pull/44))
 - implemented component `roList` ([#48](https://github.com/rokucommunity/brs/pull/48))
### Fixed
 - path handling for Windows #27 ([#45](https://github.com/rokucommunity/brs/pull/45))
 - arithmetic Operator Modulo behavior to match Roku ([#46](https://github.com/rokucommunity/brs/pull/46))



## [0.45.4](https://github.com/rokucommunity/brs/compare/v0.45.3...v0.45.4) - 2024-01-18
### Fixed
 - fixed #41 - Global functions `GetInterface()` and `FindMemberFunction()` are not properly boxing parameters ([#42](https://github.com/rokucommunity/brs/pull/42))
 - fixed #38 - Improved context handling for Callables ([#40](https://github.com/rokucommunity/brs/pull/40))
 - fixed #16 - Print leading space before positive numbers ([#39](https://github.com/rokucommunity/brs/pull/39))



## [0.45.3](https://github.com/rokucommunity/brs/compare/v0.45.2...v0.45.3) - 2023-12-01
### Added
 - missing `ifEnum` methods in `roArray` and `roAssociativeArray` ([#33](https://github.com/rokucommunity/brs/pull/33))
 - stub try/catch implementation ([#34](https://github.com/rokucommunity/brs/pull/34))
### Changed
 - replace package luxon by day.js on `roDateTime` and `roTimespan` #28 ([#29](https://github.com/rokucommunity/brs/pull/29))
### Fixed
 - component XML path parsing was failing on edge case ([#37](https://github.com/rokucommunity/brs/pull/37))
 - optional chaining implementation side effect #30 ([#31](https://github.com/rokucommunity/brs/pull/31))



## [0.45.2](https://github.com/rokucommunity/brs/compare/v0.45.1...v0.45.2) - 2023-11-07
### Added
 - logic for optional chaining ([#21](https://github.com/rokucommunity/brs/pull/21))
### Fixed
 - fix(parser): Wrong negative sign precedence was causing math errors (#6) ([#24](https://github.com/rokucommunity/brs/pull/24))
 - fix(interp): Preventing multiple calls for dot-chained methods ([#22](https://github.com/rokucommunity/brs/pull/22))



## [0.45.1](https://github.com/rokucommunity/brighterscript/compare/v0.45.0...v0.45.1) - 2023-09-08
### Changed
 - This is the first release of the RokuCommunity fork of this project
 - remove yarn in favor of npm ([#1](https://github.com/rokucommunity/brs/pull/1))
### Fixed
 - Fixed `val()` edge cases: hex without radix and `NaN` ([#3](https://github.com/rokucommunity/brs/pull/3))
