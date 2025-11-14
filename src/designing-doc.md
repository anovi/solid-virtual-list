# Designing a virtual list

## REQUIREMENTS
- [ ] track window resizing
- [ ] track container size changes
- [x] track model changes
- [x] remember collapsed items (though it may not be its responsibility, but parent's)
- [x] handle instant change of scroll position (for example scroll to a sertain item); or start positioning at the first render

## On Scrolling

Algorithm of rendering items:

1. Loop through each item:
    1. If the item is in the range, check if it was rendered before,
    if it was, check the model, if it's the same, reuse the element
    2. if it's different, create a new element; dispose the old one.
    3. Add item's height to compound height of items.
    4. If height is default (non-measured), schedule measuring.
3. Calculate expected height of rendered items.
2. When measuring scheduled, for each non-measured item:
    1. Measure height.
    2. Add height to rendered items height.
3. If measured compound height (2.2) of rendered items not equal expected (3):
    1. when items do not cover viewport — schedule additional rendering
    2. when items above vieport has unexpected height — make a scroll ajustment

## Why not to user store?

Is it possible to rewrite it to use SolidJS store? This allows to make granular updates for items.

# VIRTUAL LIST ITEMSM RENDERING

## ⬇️ SCROLL DOWN

```
| Item 1       |     | Item 1       |
| Item 2       |     | Item 2       |
| Item 3       |     | Item 3       |
----VIEWPORT----     | Item 4       |
| Item 4       |     ----VIEWPORT----
| Item 5       |     | Item 5       |
| Item 6       |     | Item 6       |
| Item 7       |     | Item 7       |
| Item 8       |     | Item 8       |
| Item 9       |     | Item 9       |
----------------     | Item 10      |
| Item 10      |     ----------------
| Item 11      |     | Item 11      |
| Item 12      |     | Item 12      |
```


Item 4 should be removed
Item 10 should be added

## ⬆️ SCROLL UP

```
| Item 1       |     | Item 1       |
| Item 2       |     | Item 2       |
| Item 3       |     ----VIEWPORT----
----VIEWPORT----     | Item 3       |
| Item 4       |     | Item 4       |
| Item 5       |     | Item 5       |
| Item 6       |     | Item 6       |
| Item 7       |     | Item 7       |
| Item 8       |     | Item 8       |
| Item 9       |     ----------------
----------------     | Item 9       |
| Item 10      |     | Item 10      |
| Item 11      |     | Item 11      |
| Item 12      |     | Item 12      |
```
