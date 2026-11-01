libphext for node.js
--------------------
This project is a fork of https://github.com/wbic16/libphext-rs.

It generally lags behind the Rust implementation a bit, but should be very close in terms of functionality.

Current Library Release: v0.1.7
Port: Complete

Coordinates (since 0.4.0)
-------------------------
Coordinate components are unbounded: any component >= 1 is valid, and walking
breaks advances components past 999 (1000, 1001, ...) instead of saturating.

Dense graphs: phext is sparse by design. Coordinate components are unbounded,
but a fully-populated dense graph contains the product of its dimensions'
extents in scrolls — a dense block spanning 1000 in each of 9 dimensions
implies 10^27 scrolls. Materializing, exploding, or indexing such a graph
costs memory proportional to its populated scroll count. The old 999 cap
never protected against this (999^9 was already unreachable); sparsity does.
Keep graphs sparse.