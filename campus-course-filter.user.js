// ==UserScript==
// @name         Campus Course Filter
// @namespace    https://local.course-filter/
// @version      1.8.0
// @description  Add fixed campus and college filters beside the course search button.
// @author       course-helper
// @match        *://*/*
// @grant        none
// @all-frames   true
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const FILTER_ID = 'campus-course-filter-panel';
  const COUNTER_ID = 'campus-course-filter-counter';
  const COLLEGE_MENU_ID = 'campus-course-filter-college-menu';
  const COLLEGE_BUTTON_ID = 'campus-course-filter-college-button';

  const TEXT = {
    title: '\u6821\u533a\u7b5b\u9009',
    all: '\u5168\u90e8\u6821\u533a',
    tang: '\u5510\u5c9b\u6e7e\u6821\u533a',
    gu: '\u53e4\u9547\u53e3\u6821\u533a',
    campusHeader: '\u4e0a\u8bfe\u6821\u533a',
    courseCodeHeader: '\u8bfe\u7a0b\u7f16\u53f7',
    collegeTitle: '\u5b66\u9662\u7b5b\u9009',
    selectAll: '\u5168\u9009',
    clearAll: '\u6e05\u7a7a',
    query: '\u67e5\u8be2',
    wait: '\u7b49\u5f85\u67e5\u8be2',
    show: '\u663e\u793a',
    countUnit: '\u6761',
  };

  const CAMPUS_OPTIONS = [
    { value: '', label: '\u5168\u90e8' },
    { value: TEXT.tang, label: '\u5510\u5c9b\u6e7e' },
    { value: TEXT.gu, label: '\u53e4\u9547\u53e3' },
  ];

  const COLLEGE_OPTIONS = [
    { code: 'GEO', name: '\u5730\u7403\u79d1\u5b66\u4e0e\u6280\u672f\u5b66\u9662' },
    { code: 'SPE', name: '\u77f3\u6cb9\u5de5\u7a0b\u5b66\u9662' },
    { code: 'CHM', name: '\u5316\u5b66\u5316\u5de5\u5b66\u9662' },
    { code: 'MEE', name: '\u673a\u7535\u5de5\u7a0b\u5b66\u9662' },
    { code: 'PLC', name: '\u50a8\u8fd0\u4e0e\u5efa\u7b51\u5de5\u7a0b\u5b66\u9662' },
    { code: 'MAT', name: '\u6750\u6599\u79d1\u5b66\u4e0e\u5de5\u7a0b\u5b66\u9662' },
    { code: 'CNE', name: '\u77f3\u5927\u5c71\u80fd\u65b0\u80fd\u6e90\u5b66\u9662' },
    { code: 'OSI', name: '\u6d77\u6d0b\u4e0e\u7a7a\u95f4\u4fe1\u606f\u5b66\u9662' },
    { code: 'CTL', name: '\u63a7\u5236\u79d1\u5b66\u4e0e\u5de5\u7a0b\u5b66\u9662' },
    { code: 'CST', name: '\u9752\u5c9b\u8f6f\u4ef6\u5b66\u9662\u3001\u8ba1\u7b97\u673a\u79d1\u5b66\u4e0e\u6280\u672f\u5b66\u9662' },
    { code: 'SCC', name: '\u7406\u5b66\u9662' },
    { code: 'SEM', name: '\u7ecf\u6d4e\u7ba1\u7406\u5b66\u9662' },
    { code: 'SFS', name: '\u5916\u56fd\u8bed\u5b66\u9662' },
    { code: 'SHL', name: '\u6587\u6cd5\u5b66\u9662' },
    { code: 'MRX', name: '\u9a6c\u514b\u601d\u4e3b\u4e49\u5b66\u9662' },
    { code: 'UPE', name: '\u4f53\u80b2\u6559\u5b66\u90e8' },
  ];

  let selectedCampus = '';
  let selectedColleges = new Set(COLLEGE_OPTIONS.map((item) => item.code));
  let pendingApply = 0;

  function normalizeText(text) {
    return String(text || '').replace(/\s+/g, '').trim();
  }

  function findQueryButton() {
    const candidates = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a'));
    return candidates.find((item) => normalizeText(item.textContent || item.value) === TEXT.query);
  }

  function findCourseTable() {
    const tables = Array.from(document.querySelectorAll('table'));

    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll('tr'));
      for (const row of rows) {
        const cells = Array.from(row.children);
        const campusIndex = cells.findIndex((cell) => normalizeText(cell.textContent) === TEXT.campusHeader);
        const courseCodeIndex = cells.findIndex((cell) => normalizeText(cell.textContent) === TEXT.courseCodeHeader);
        if (campusIndex !== -1) {
          return { table, headerRow: row, campusIndex, courseCodeIndex: courseCodeIndex === -1 ? 0 : courseCodeIndex };
        }
      }
    }

    return null;
  }

  function getBodyRows(found) {
    const rows = Array.from(found.table.querySelectorAll('tr'));
    const headerPosition = rows.indexOf(found.headerRow);

    return rows.slice(headerPosition + 1).filter((row) => {
      const text = normalizeText(row.textContent);
      return row.children.length > 1 && text && !text.includes('\u5f53\u524d\u663e\u793a');
    });
  }

  function removePanel() {
    const panel = document.getElementById(FILTER_ID);
    if (panel) panel.remove();
  }

  function shouldShowPanel() {
    return Boolean(findQueryButton() && findCourseTable());
  }

  function placePanel(panel) {
    const queryButton = findQueryButton();
    if (!queryButton) return;

    const rect = queryButton.getBoundingClientRect();
    panel.style.left = `${Math.round(rect.right + 14)}px`;
    panel.style.top = `${Math.round(rect.top)}px`;
  }

  function createFilterPanel() {
    if (!shouldShowPanel()) {
      removePanel();
      return null;
    }

    let panel = document.getElementById(FILTER_ID);
    if (panel) {
      placePanel(panel);
      return panel;
    }

    panel = document.createElement('div');
    panel.id = FILTER_ID;
    panel.style.cssText = [
      'position:fixed',
      'z-index:2147483647',
      'display:flex',
      'align-items:center',
      'gap:10px',
      'height:38px',
      'padding:0 12px',
      'background:#fff',
      'border:1px solid #5b8cff',
      'box-shadow:0 2px 8px rgba(0,0,0,.10)',
      'border-radius:4px',
      'font-size:14px',
      'color:#111827',
      'box-sizing:border-box',
      'min-width:560px',
    ].join(';');

    const label = document.createElement('label');
    label.textContent = TEXT.title;
    label.style.cssText = 'font-weight:700;white-space:nowrap';

    const buttonGroup = document.createElement('div');
    buttonGroup.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:4px',
      'height:28px',
      'white-space:nowrap',
    ].join(';');

    function refreshButtons() {
      Array.from(buttonGroup.querySelectorAll('button')).forEach((button) => {
        const active = button.getAttribute('data-campus-value') === selectedCampus;
        button.style.background = active ? '#4f8cff' : '#fff';
        button.style.color = active ? '#fff' : '#1f2937';
        button.style.borderColor = active ? '#4f8cff' : '#b7c4d8';
        button.style.fontWeight = active ? '700' : '400';
      });
    }

    CAMPUS_OPTIONS.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.label;
      button.setAttribute('data-campus-value', option.value);
      button.style.cssText = [
        'height:28px',
        'line-height:26px',
        'padding:0 10px',
        'border:1px solid #b7c4d8',
        'border-radius:4px',
        'background:#fff',
        'color:#1f2937',
        'font-size:14px',
        'font-family:inherit',
        'cursor:pointer',
        'box-sizing:border-box',
        'white-space:nowrap',
      ].join(';');

      button.addEventListener('click', () => {
        selectedCampus = option.value;
        refreshButtons();
        applyCampusFilter();
      });

      buttonGroup.appendChild(button);
    });
    refreshButtons();

    const collegeFilter = document.createElement('div');
    collegeFilter.style.cssText = [
      'position:relative',
      'display:flex',
      'align-items:center',
      'gap:6px',
      'height:28px',
      'white-space:nowrap',
    ].join(';');

    const collegeButton = document.createElement('button');
    collegeButton.id = COLLEGE_BUTTON_ID;
    collegeButton.type = 'button';
    collegeButton.style.cssText = [
      'height:28px',
      'line-height:26px',
      'min-width:118px',
      'padding:0 10px',
      'border:1px solid #b7c4d8',
      'border-radius:4px',
      'background:#fff',
      'color:#1f2937',
      'font-size:14px',
      'font-family:inherit',
      'cursor:pointer',
      'box-sizing:border-box',
      'white-space:nowrap',
      'text-align:left',
    ].join(';');

    const collegeMenu = document.createElement('div');
    collegeMenu.id = COLLEGE_MENU_ID;
    collegeMenu.style.cssText = [
      'display:none',
      'position:absolute',
      'left:0',
      'top:34px',
      'width:360px',
      'max-height:360px',
      'overflow:auto',
      'padding:10px',
      'background:#fff',
      'border:1px solid #5b8cff',
      'box-shadow:0 6px 18px rgba(0,0,0,.18)',
      'border-radius:6px',
      'box-sizing:border-box',
      'z-index:2147483647',
    ].join(';');

    function updateCollegeButton() {
      collegeButton.textContent = selectedColleges.size === COLLEGE_OPTIONS.length
        ? `${TEXT.collegeTitle}\uff1a${TEXT.selectAll}`
        : `${TEXT.collegeTitle}\uff1a${selectedColleges.size}/${COLLEGE_OPTIONS.length}`;
    }

    function syncCollegeChecks() {
      Array.from(collegeMenu.querySelectorAll('input[type="checkbox"]')).forEach((checkbox) => {
        checkbox.checked = selectedColleges.has(checkbox.value);
      });
      updateCollegeButton();
    }

    const collegeActions = document.createElement('div');
    collegeActions.style.cssText = 'display:flex;gap:8px;margin-bottom:8px';

    const selectAllButton = document.createElement('button');
    selectAllButton.type = 'button';
    selectAllButton.textContent = TEXT.selectAll;
    selectAllButton.style.cssText = 'height:26px;padding:0 10px;border:1px solid #b7c4d8;border-radius:4px;background:#fff;cursor:pointer';
    selectAllButton.addEventListener('click', () => {
      selectedColleges = new Set(COLLEGE_OPTIONS.map((item) => item.code));
      syncCollegeChecks();
      applyCampusFilter();
    });

    const clearAllButton = document.createElement('button');
    clearAllButton.type = 'button';
    clearAllButton.textContent = TEXT.clearAll;
    clearAllButton.style.cssText = 'height:26px;padding:0 10px;border:1px solid #b7c4d8;border-radius:4px;background:#fff;cursor:pointer';
    clearAllButton.addEventListener('click', () => {
      selectedColleges = new Set();
      syncCollegeChecks();
      applyCampusFilter();
    });

    collegeActions.append(selectAllButton, clearAllButton);
    collegeMenu.appendChild(collegeActions);

    COLLEGE_OPTIONS.forEach((option) => {
      const item = document.createElement('label');
      item.style.cssText = [
        'display:flex',
        'align-items:center',
        'gap:8px',
        'height:28px',
        'font-size:13px',
        'color:#111827',
        'cursor:pointer',
        'white-space:nowrap',
      ].join(';');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = option.code;
      checkbox.checked = true;
      checkbox.style.cssText = 'margin:0';
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedColleges.add(option.code);
        else selectedColleges.delete(option.code);
        updateCollegeButton();
        applyCampusFilter();
      });

      const text = document.createElement('span');
      text.textContent = `${option.code} ${option.name}`;

      item.append(checkbox, text);
      collegeMenu.appendChild(item);
    });

    collegeButton.addEventListener('click', () => {
      collegeMenu.style.display = collegeMenu.style.display === 'none' ? 'block' : 'none';
    });
    updateCollegeButton();
    collegeFilter.append(collegeButton, collegeMenu);

    const counter = document.createElement('span');
    counter.id = COUNTER_ID;
    counter.style.cssText = 'min-width:58px;color:#4b5563;font-size:12px;white-space:nowrap';
    counter.textContent = TEXT.wait;

    panel.append(label, buttonGroup, collegeFilter, counter);
    document.body.appendChild(panel);
    placePanel(panel);
    return panel;
  }

  function setCounter(message) {
    const counter = document.getElementById(COUNTER_ID);
    if (counter) counter.textContent = message;
  }

  function campusMatches(row, campusIndex) {
    const campusCell = row.children[campusIndex];
    const campusText = normalizeText(campusCell ? campusCell.textContent : '');
    return !selectedCampus || campusText.includes(selectedCampus);
  }

  function collegeMatches(row, courseCodeIndex) {
    if (selectedColleges.size === COLLEGE_OPTIONS.length) return true;

    const courseCodeCell = row.children[courseCodeIndex];
    const courseCode = normalizeText(courseCodeCell ? courseCodeCell.textContent : '').toUpperCase();
    const collegeCode = courseCode.slice(0, 3);
    return selectedColleges.has(collegeCode);
  }

  function applyCampusFilter() {
    const panel = createFilterPanel();
    if (!panel) return;

    const found = findCourseTable();
    if (!found) {
      removePanel();
      return;
    }

    const rows = getBodyRows(found);
    let shown = 0;

    rows.forEach((row) => {
      const shouldShow = campusMatches(row, found.campusIndex) && collegeMatches(row, found.courseCodeIndex);
      row.style.display = shouldShow ? '' : 'none';
      if (shouldShow) shown += 1;
    });

    setCounter(`${TEXT.show}${shown}${TEXT.countUnit}`);
    placePanel(panel);
  }

  function scheduleApply(delay) {
    window.clearTimeout(pendingApply);
    pendingApply = window.setTimeout(applyCampusFilter, typeof delay === 'number' ? delay : 200);
  }

  const observer = new MutationObserver(() => scheduleApply(250));
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener('resize', () => scheduleApply(0));

  document.addEventListener('click', (event) => {
    const panel = document.getElementById(FILTER_ID);
    if (panel && panel.contains(event.target)) return;

    const collegeMenu = document.getElementById(COLLEGE_MENU_ID);
    if (collegeMenu) collegeMenu.style.display = 'none';

    const text = normalizeText(event.target && (event.target.textContent || event.target.value));
    if (text === TEXT.query || text === '\u9996\u9875' || text === '\u4e0a\u4e00\u9875' || text === '\u4e0b\u4e00\u9875' || text === '\u672b\u9875' || /^\d+$/.test(text)) {
      scheduleApply(500);
    }
  }, true);

  scheduleApply(400);
})();
