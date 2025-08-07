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