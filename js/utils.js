/**
 * DOM utility functions
 */

/**
 * Clear all child nodes from a DOM element
 * @param {Element} element - The DOM element to clear
 */
export function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * Create a text node with given content
 * @param {string} text - Text content
 * @returns {Text} Text node
 */
export function createTextNode(text) {
  return document.createTextNode(text);
}

/**
 * Create an element with optional text content
 * @param {string} tagName - HTML tag name
 * @param {string} textContent - Optional text content
 * @returns {Element} Created element
 */
export function createElement(tagName, textContent = '') {
  const element = document.createElement(tagName);
  if (textContent) {
    element.appendChild(createTextNode(textContent));
  }
  return element;
}

/**
 * Defers the execution of a function until the next animation frame.
 * If called multiple times before the frame, only the last arguments are used.
 * Returns a promise that resolves after the function is called.
 * @param {Function} fn - Function to defer
 * @returns {Function} Deferred function
 */
export function deferUntilAnimationFrame(fn) {
  let lastArgs = null;
  let promise = null;
  let alreadyEnqueued = false;
  return ((...args) => {
    lastArgs = args;

    if (!alreadyEnqueued) {
      alreadyEnqueued = true;
      promise = new Promise((resolve) => {
        window.requestAnimationFrame(() => {
          try {
            fn(...lastArgs);
          } finally {
            resolve();
            lastArgs = null;
            promise = null;
            alreadyEnqueued = false;
          }
        });
      });
    }

    return promise;
  });
}