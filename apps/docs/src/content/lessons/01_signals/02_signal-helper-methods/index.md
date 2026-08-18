---
title: Signal helper methods
description: Helper methods for working with signals
section: Signals
---

In the previous lesson we used the `.increment()` method to update our count signal. This is one of the many mutation helpers we provide on signal.

Working with signals with just `.set()` and `.update()` isn't the best experience, so we include helper methods for mutating signals depending on their type:

| Method         | Type      |
| -------------- | --------- |
| `.toggle()`    | `boolean` |
| `.increment()` | `number`  |
| `.decrement()` | `number`  |
| `.push()`      | `T[]`     |
| `.pop()`       | `T[]`     |
| `.unshift()`   | `T[]`     |
| `.shift()`     | `T[]`     |
| `.splice()`    | `T[]`     |

Try using the `.push()` method to add an item to `items` when we click the button.

```ts
function addItem() {
	items.push('new item');
}
```
