import { connectorStyles, connectorScript } from './connector-dashboard';
import { operatingStyles, operatingScript } from './operating-dashboard';
import { compactNavigation, planningMarkup, compactStyles, planningScript } from './planning-dashboard';
import {liveNavigation,liveMarkup,liveStyles,liveScript} from './live-dashboard';
const legacyHtml = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AscendXI / Company desk</title>
    <style nonce="__NONCE__">
      :root {
        --paper: #f4f1ea;
        --ink: #252a27;
        --quiet: #656c64;
        --line: #d8d9d0;
        --panel: #fffdf8;
        --accent: #c9532f;
        --sage: #e4eadb;
        --warning: #f8e8c6;
        --blue: #e1e9ee;
        --serif: Georgia, 'Times New Roman', serif;
        --sans: 'Avenir Next', Avenir, 'Trebuchet MS', sans-serif;
        --mono: 'SFMono-Regular', Consolas, monospace;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: var(--paper);
        color: var(--ink);
        font: 15px/1.55 var(--sans);
      }
      button,
      input,
      select,
      textarea {
        font: inherit;
      }
      button,
      a {
        touch-action: manipulation;
      }
      button {
        cursor: pointer;
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
      button:focus-visible,
      a:focus-visible,
      input:focus-visible,
      select:focus-visible,
      textarea:focus-visible {
        outline: 3px solid var(--accent);
        outline-offset: 3px;
      }
      button {
        border: 1px solid var(--line);
        color: var(--ink);
        background: transparent;
        padding: 9px 15px;
        border-radius: 4px;
      }
      button.primary {
        background: var(--ink);
        border-color: var(--ink);
        color: var(--panel);
      }
      button:hover:not(:disabled) {
        background: var(--sage);
      }
      button.primary:hover:not(:disabled) {
        background: #414b42;
      }
      a {
        color: inherit;
      }
      h1,
      h2,
      h3,
      p {
        margin-top: 0;
      }
      h1 {
        font: clamp(36px, 4.4vw, 65px)/1.06 var(--serif);
        letter-spacing: -2px;
        margin-bottom: 20px;
      }
      h2 {
        font: 29px/1.2 var(--serif);
        letter-spacing: -0.6px;
      }
      h3 {
        font-size: 16px;
        line-height: 1.4;
      }
      small,
      .muted {
        color: var(--quiet);
      }
      .shell {
        display: grid;
        grid-template-columns: 220px minmax(0, 1fr);
        min-height: 100vh;
      }
      .sidebar {
        min-width: 0;
        background: #253c32;
        color: #f3f1e8;
        padding: 32px 20px;
        display: flex;
        flex-direction: column;
        gap: 30px;
      }
      .brand {
        font-size: 24px;
        font-weight: 650;
        letter-spacing: -1px;
      }
      .brand span {
        color: #eba584;
      }
      .brand small {
        display: block;
        color: #c5d1c3;
        font: 10px var(--mono);
        letter-spacing: 2px;
        margin-top: 8px;
      }
      .sidebar nav {
        display: grid;
        gap: 5px;
      }
      .sidebar nav button {
        border: 0;
        text-align: left;
        color: #d4dfd0;
        padding: 11px 13px;
      }
      .sidebar nav button.active {
        background: #f2f1e6;
        color: #253c32;
      }
      .navindex {
        display: inline-block;
        font: 10px var(--mono);
        width: 26px;
        opacity: 0.7;
      }
      .sidefoot {
        margin-top: auto;
        font-size: 12px;
        color: #c5d1c3;
      }
      .sidefoot a {
        display: block;
        margin: 12px 0;
      }
      .work {
        min-width: 0;
        padding: 0 42px 40px;
      }
      .topbar {
        height: 76px;
        border-bottom: 1px solid var(--line);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .eyebrow {
        font: 11px var(--mono);
        letter-spacing: 1.5px;
        text-transform: uppercase;
        color: var(--quiet);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        border-radius: 3px;
        padding: 4px 9px;
        font-size: 11px;
        font-weight: 600;
        background: var(--sage);
        white-space: nowrap;
      }
      .badge.warning {
        background: var(--warning);
      }
      .badge.draft {
        background: var(--blue);
      }
      .badge.neutral {
        background: #e7e7df;
      }
      .hero {
        display: grid;
        grid-template-columns: 1fr 260px;
        align-items: end;
        gap: 34px;
        padding: 40px 0 28px;
      }
      .hero p {
        max-width: 620px;
        color: var(--quiet);
        font-size: 16px;
        margin: 0;
      }
      .hero aside {
        border-left: 2px solid var(--accent);
        padding-left: 18px;
      }
      .hero aside strong {
        font-size: 13px;
      }
      .hero aside p {
        font-size: 12px;
        margin-top: 7px;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        border-top: 1px solid var(--line);
        border-bottom: 1px solid var(--line);
        margin-bottom: 32px;
      }
      .stat {
        padding: 20px 14px 20px 0;
      }
      .stat:not(:first-child) {
        border-left: 1px solid var(--line);
        padding-left: 20px;
      }
      .number {
        display: block;
        font: 38px/1.2 var(--serif);
        margin: 8px 0 3px;
      }
      .stat small {
        font-size: 11px;
      }
      .sectionhead {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        margin: 28px 0 15px;
      }
      .sectionhead h2 {
        margin: 0;
      }
      .gridtwo {
        display: grid;
        grid-template-columns: 1.3fr 1fr;
        gap: 28px;
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        padding: 22px;
        border-radius: 5px;
      }
      .panel h3 {
        margin-bottom: 6px;
      }
      .stack {
        display: grid;
        gap: 12px;
      }
      .orgtop {
        display: grid;
        place-items: center;
        margin: 8px 0 20px;
      }
      .orgtop strong {
        background: var(--ink);
        color: var(--panel);
        padding: 12px 28px;
        font-size: 14px;
      }
      .orgtop small {
        margin-top: 9px;
      }
      .orggroups {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
      }
      .orggroup {
        border-top: 2px solid var(--accent);
        padding-top: 15px;
      }
      .orggroup h3 {
        text-transform: capitalize;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }
      .chips button {
        font-size: 12px;
        padding: 5px 9px;
        background: var(--paper);
      }
      .loop {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 8px;
      }
      .loopstep {
        border-top: 2px solid var(--line);
        padding: 12px 0;
        min-width: 0;
      }
      .loopstep strong {
        display: block;
        font: 27px var(--serif);
      }
      .loopstep p {
        font-size: 12px;
        margin: 7px 0 0;
      }
      .loopstep small {
        font: 10px var(--mono);
      }
      .loopstep.attention {
        border-color: var(--accent);
      }
      .goal {
        border-top: 1px solid var(--line);
        padding: 18px 0;
      }
      .goal:first-child {
        border: 0;
        padding-top: 4px;
      }
      .goal h3 {
        margin-bottom: 7px;
      }
      .goal p {
        font-size: 13px;
        color: var(--quiet);
        margin-bottom: 12px;
      }
      .progress {
        height: 5px;
        background: #e3e6db;
        margin: 10px 0;
      }
      .progress i {
        display: block;
        height: 100%;
        background: #497252;
      }
      .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .row small {
        font-size: 11px;
      }
      .actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .notice {
        background: var(--warning);
        padding: 13px 16px;
        font-size: 13px;
        border-radius: 4px;
        margin-bottom: 20px;
      }
      .record {
        padding: 16px 0;
        border-top: 1px solid var(--line);
        cursor: pointer;
      }
      .record h3 {
        margin: 0 0 5px;
      }
      .record p {
        font-size: 13px;
        color: var(--quiet);
        margin: 0;
      }
      .toolbar {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin: 20px 0;
      }
      .toolbar input {
        min-width: 170px;
        flex: 1;
      }
      .toolbar select {
        max-width: 220px;
      }
      .board {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 12px;
        align-items: start;
      }
      .column {
        min-width: 0;
      }
      .columnhead {
        padding: 9px 0 15px;
        display: flex;
        justify-content: space-between;
        border-bottom: 2px solid var(--line);
        font-size: 12px;
        font-weight: 600;
      }
      .task {
        background: var(--panel);
        border: 1px solid var(--line);
        padding: 15px;
        margin-top: 12px;
        border-radius: 4px;
        overflow-wrap: anywhere;
      }
      .task h3 {
        font-size: 13px;
        margin: 10px 0;
      }
      .task .eyebrow {
        font-size: 9px;
        letter-spacing: 0.5px;
      }
      .task button {
        font-size: 11px;
        padding: 5px 8px;
        margin-top: 10px;
      }
      .task small {
        font-size: 10px;
      }
      .task.review {
        border-top: 3px solid var(--accent);
      }
      .empty {
        color: var(--quiet);
        font-size: 13px;
        padding: 20px 0;
      }
      .tablewrap {
        overflow-x: auto;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        font-size: 13px;
      }
      th,
      td {
        text-align: left;
        padding: 14px 12px 14px 0;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }
      th {
        font: 10px var(--mono);
        color: var(--quiet);
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .clickable {
        cursor: pointer;
      }
      .clickable:hover {
        background: var(--sage);
      }
      .view[hidden] {
        display: none;
      }
      .view {
        padding-top: 28px;
      }
      .date {
        font: 10px var(--mono);
        color: var(--quiet);
      }
      .activityrow {
        display: grid;
        grid-template-columns: 130px 1fr auto;
        gap: 15px;
        padding: 15px 0;
        border-bottom: 1px solid var(--line);
        font-size: 13px;
      }
      dialog {
        background: var(--panel);
        color: var(--ink);
        border: 1px solid var(--line);
        border-radius: 7px;
        width: min(760px, calc(100vw - 30px));
        max-height: 90vh;
        padding: 28px;
      }
      dialog::backdrop {
        background: rgba(20, 30, 23, 0.45);
      }
      .dialoghead {
        display: flex;
        gap: 15px;
        justify-content: space-between;
        align-items: start;
        border-bottom: 1px solid var(--line);
        padding-bottom: 14px;
        margin-bottom: 20px;
      }
      .dialoghead h2 {
        margin: 0;
      }
      .close {
        font-size: 19px;
        padding: 0 8px;
        border: 0;
      }
      label {
        display: grid;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        margin: 14px 0;
      }
      input,
      textarea,
      select {
        width: 100%;
        padding: 10px 11px;
        background: var(--panel);
        border: 1px solid #b9c1b4;
        border-radius: 4px;
        color: var(--ink);
      }
      textarea {
        resize: vertical;
        min-height: 90px;
      }
      .formgrid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
      }
      .formgrid label {
        margin: 0;
      }
      .content {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font: 14px/1.8 var(--sans);
      }
      .source {
        font: 12px/1.6 var(--mono);
        padding: 12px;
        background: var(--paper);
        overflow-wrap: anywhere;
      }
      .status {
        min-height: 23px;
        font-size: 12px;
        color: var(--quiet);
      }
      #error {
        color: #96341f;
      }
      #login {
        margin: 55px auto;
        max-width: 430px;
      }
      #login h1 {
        font-size: 38px;
      }
      #login p {
        font-size: 14px;
        color: var(--quiet);
      }
      .loading {
        padding: 60px 0;
        color: var(--quiet);
      }
      .sr {
        position: absolute;
        clip: rect(0, 0, 0, 0);
        width: 1px;
        height: 1px;
        overflow: hidden;
      }
      @media (max-width: 1200px) {
        .work {
          padding: 0 25px 30px;
        }
        .hero {
          grid-template-columns: minmax(0, 1fr);
        }
        .hero aside {
          display: none;
        }
        .board {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .gridtwo {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      @media (max-width: 760px) {
        .shell {
          grid-template-columns: minmax(0, 1fr);
        }
        .sidebar {
          padding: 18px;
          gap: 15px;
        }
        .sidebar nav {
          display: flex;
          gap: 5px;
          overflow-x: auto;
        }
        .sidebar nav button {
          white-space: nowrap;
          padding: 8px;
        }
        .sidefoot {
          display: none;
        }
        .brand small {
          display: none;
        }
        .work {
          padding: 0 18px 25px;
        }
        .topbar {
          height: auto;
          min-height: 66px;
          flex-wrap: wrap;
          padding: 12px 0;
        }
        .hero {
          padding-top: 30px;
        }
        .hero h1 {
          letter-spacing: -1px;
        }
        .stats {
          grid-template-columns: 1fr 1fr;
        }
        .stat:nth-child(3) {
          border-left: 0;
          padding-left: 0;
          border-top: 1px solid var(--line);
        }
        .stat:nth-child(4) {
          border-top: 1px solid var(--line);
        }
        .board {
          grid-template-columns: 1fr 1fr;
        }
        .orggroups {
          grid-template-columns: minmax(0, 1fr);
        }
        .loop {
          grid-template-columns: repeat(3, 1fr);
        }
        .sectionhead {
          align-items: start;
        }
        .formgrid {
          grid-template-columns: minmax(0, 1fr);
        }
        .activityrow {
          grid-template-columns: 90px 1fr;
        }
        .activityrow .badge {
          grid-column: 2;
        }
        .toolbar select {
          max-width: none;
        }
        .panel {
          padding: 17px;
        }
      }
      @media (max-width: 430px) {
        .board {
          grid-template-columns: minmax(0, 1fr);
        }
        .loop {
          grid-template-columns: 1fr 1fr;
        }
        .navindex {
          display: none;
        }
        .number {
          font-size: 32px;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          Ascend<span>XI</span><small>COMPANY OPERATING SYSTEM</small>
        </div>
        <nav aria-label="Company sections">
          <button class="active" data-view="overview">
            <span class="navindex">01</span> Company desk</button
          ><button data-view="goals">
            <span class="navindex">02</span> Goals</button
          ><button data-view="workboard">
            <span class="navindex">03</span> Workboard</button
          ><button data-view="knowledge">
            <span class="navindex">04</span> Knowledge</button
          ><button data-view="clients">
            <span class="navindex">05</span> Clients</button
          ><button data-view="resources">
            <span class="navindex">06</span> Resources</button
          ><button data-view="activity">
            <span class="navindex">07</span> Events</button
          ><button data-view="projects">
            <span class="navindex">08</span> Projects</button
          ><button data-view="conversations">
            <span class="navindex">09</span> Conversations</button
          ><button data-view="outbox">
            <span class="navindex">10</span> Outbox
          </button>
        </nav>
        <div class="sidefoot">
          An accountable company.<br />One shared source of truth.<a
            href="/agents"
            >Open agent workspace ↗</a
          ><a href="/workflows">Inspect workflows ↗</a>
        </div>
      </aside>
      <main class="work">
        <header class="topbar">
          <span class="eyebrow">ASCENDXI / COMPANY DESK</span>
          <div class="actions">
            <span id="modelBadge" class="badge warning"
              >Checking model access</span
            ><button id="refresh">Refresh</button>
          </div>
        </header>
        <div class="notice" id="workerStatus" hidden></div>
        <div id="status" class="status" aria-live="polite"></div>
        <div id="error" class="status" role="alert"></div>
        <section id="login" hidden>
          <h1>Your company, securely.</h1>
          <p>
            Open this desk from your signed-in Mastra Studio. Direct server
            access requires the private operator API key. It stays in memory for
            this visit.
          </p>
          <form id="loginForm">
            <label
              >Operator API key<input
                id="apiKey"
                type="password"
                autocomplete="off"
                required /></label
            ><button class="primary">Open company desk</button>
          </form>
        </section>
        <div id="app" hidden>
          <section class="view" id="overview">
            <div class="hero">
              <div>
                <p class="eyebrow">THE OPERATING PICTURE</p>
                <h1>Company, in motion.</h1>
                <p>
                  Goals set the direction. Specialists own the work. Shared
                  knowledge keeps every decision grounded.
                </p>
              </div>
              <aside>
                <strong>Authority stays visible.</strong>
                <p>
                  Reports, approvals and executed actions are different records.
                  A draft is never presented as delivered work.
                </p>
              </aside>
            </div>
            <div id="stats" class="stats"></div>
            <div id="modelNotice" class="notice" hidden></div>
            <div class="gridtwo">
              <section>
                <div class="sectionhead">
                  <h2>The organization</h2>
                  <span class="eyebrow" id="agentCount"></span>
                </div>
                <div class="panel">
                  <div class="orgtop">
                    <strong>AI Co-Founder</strong
                    ><small>Priorities · handoffs · founder decisions</small>
                  </div>
                  <div id="orggroups" class="orggroups"></div>
                </div>
                <div class="sectionhead">
                  <h2>Service connections</h2>
                  <button id="verifyConnections">Verify read access</button>
                </div>
                <div id="integrations" class="stack"></div>
                <div class="sectionhead"><h2>From intent to evidence</h2></div>
                <div id="loop" class="loop"></div>
              </section>
              <section>
                <div class="sectionhead">
                  <h2>Where we’re heading</h2>
                  <button data-view="goals">All goals ↗</button>
                </div>
                <div id="goalPreview" class="panel"></div>
                <div class="sectionhead">
                  <h2>Knowledge to review</h2>
                  <button data-view="knowledge">Open library ↗</button>
                </div>
                <div id="knowledgePreview" class="panel"></div>
              </section>
            </div>
          </section>
          <section class="view" id="goals" hidden>
            <div class="sectionhead">
              <div>
                <p class="eyebrow">DIRECTION / MEASURABLE OUTCOMES</p>
                <h1>Goals & commitments.</h1>
              </div>
              <button class="primary" id="newGoal">Add a goal</button>
            </div>
            <p class="muted">
              Progress counts accepted tasks linked to each goal. No estimated
              business metrics are implied.
            </p>
            <div id="goalsList" class="stack"></div>
          </section>
          <section class="view" id="workboard" hidden>
            <div class="sectionhead">
              <div>
                <p class="eyebrow">OWNERSHIP / REVIEW / DELIVERY</p>
                <h1>The work, out in the open.</h1>
              </div>
              <button class="primary" id="newTask">Create assignment</button>
            </div>
            <div class="toolbar">
              <label class="sr" for="taskSearch">Search tasks</label
              ><input id="taskSearch" placeholder="Find an assignment…" /><label
                class="sr"
                for="departmentFilter"
                >Department</label
              ><select id="departmentFilter">
                <option value="">All departments</option></select
              ><label class="sr" for="goalFilter">Goal</label
              ><select id="goalFilter">
                <option value="">All goals</option>
              </select>
            </div>
            <div id="board" class="board"></div>
            <p class="muted">
              <small
                >Showing up to 200 recent assignments. All reports remain
                available through the task tools.</small
              >
            </p>
          </section>
          <section class="view" id="knowledge" hidden>
            <div class="sectionhead">
              <div>
                <p class="eyebrow">SOURCED / VERSIONED / SHARED</p>
                <h1>What the company knows.</h1>
              </div>
              <button class="primary" id="newKnowledge">Add knowledge</button>
            </div>
            <p class="muted">
              Verified records inform agents. Proposed updates remain drafts
              until reviewed; previous revisions stay available.
            </p>
            <div class="toolbar">
              <label class="sr" for="knowledgeSearch">Search knowledge</label
              ><input
                id="knowledgeSearch"
                placeholder="Search titles, content and sources…"
              /><label class="sr" for="knowledgeFilter">Knowledge state</label
              ><select id="knowledgeFilter">
                <option value="">All states</option>
                <option value="verified">Verified</option>
                <option value="draft">Drafts</option>
                <option value="due">Review due</option>
              </select>
            </div>
            <div class="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Record</th>
                    <th>Product</th>
                    <th>State</th>
                    <th>Revision</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody id="knowledgeList"></tbody>
              </table>
            </div>
          </section>
          <section class="view" id="clients" hidden>
            <div class="sectionhead">
              <div>
                <p class="eyebrow">ACQUISITION / DISCOVERY / DELIVERY</p>
                <h1>From first contact<br />to lasting partnership.</h1>
              </div>
              <button class="primary" id="newLead">Add sourced lead</button>
            </div>
            <p class="muted">
              Track evidence and ownership across the client lifecycle. A stage
              update does not send an email, book a meeting or commit a delivery
              date.
            </p>
            <div id="pipeline" class="loop"></div>
            <div id="clientList" class="stack"></div>
            <div class="sectionhead"><h2>Saved estimates</h2></div>
            <div id="estimateList" class="stack"></div>
          </section>
          <section class="view" id="resources" hidden>
            <div class="sectionhead">
              <div>
                <p class="eyebrow">CAPABILITIES / CAPACITY / ASSUMPTIONS</p>
                <h1>Plan with what’s real.</h1>
              </div>
              <button class="primary" id="newResource">Add resource</button>
            </div>
            <p class="muted">
              Registered agents describe capabilities. Delivery estimates need
              sourced, reviewed capacity and rates. Estimates do not reserve
              resources.
            </p>
            <div id="resourceList" class="stack"></div>
          </section>
          <section class="view" id="activity" hidden>
            <p class="eyebrow">APPEND-ONLY / PERSISTED EVENTS</p>
            <h1>Every handoff leaves a trail.</h1>
            <p class="muted">
              Actual task transitions, project messages, worker activity,
              approvals and provider receipts. Earlier records before this
              ledger was installed are not reconstructed.
            </p>
            <div class="toolbar">
              <input
                id="eventSearch"
                aria-label="Search events"
                placeholder="Search actor, event or summary"
              />
            </div>
            <div id="activityList"></div>
            <button id="olderEvents">Load older events</button>
          </section>
          <section class="view" id="projects" hidden>
            <div class="sectionhead">
              <div>
                <p class="eyebrow">AWARD / DEPENDENCIES / DELIVERY</p>
                <h1>One project. Clear ownership.</h1>
              </div>
              <button class="primary" id="newProject">
                Record approved project
              </button>
            </div>
            <p class="muted">
              Record a won client opportunity or a founder-approved internal
              brief. The worker follows dependencies and produces reviewable
              artifacts. Implementation, deployments and external delivery
              require their own evidence.
            </p>
            <div id="projectList" class="stack"></div>
          </section>
          <section class="view" id="conversations" hidden>
            <p class="eyebrow">PROJECT ROOMS / ACTUAL OUTPUTS</p>
            <h1>See the conversation.</h1>
            <p class="muted">
              Assignments, specialist deliverables, independent reviews,
              operator notes and tracked client email. These are saved work
              outputs; hidden model reasoning is not collected.
            </p>
            <div class="toolbar">
              <select
                id="conversationProject"
                aria-label="Conversation project"
              ></select>
            </div>
            <form id="chatForm" class="panel">
              <label
                >Talk to an agent<select
                  id="chatAgent"
                  aria-label="Agent to speak with"
                ></select
              ></label>
              <label
                >Your request<textarea
                  id="chatMessage"
                  required
                  maxlength="10000"
                  placeholder="Ask about company priorities, inspect project evidence, or assign bounded work."
                ></textarea>
              </label>
              <p class="muted">
                Responses and tool activity are saved. This chat uses internal
                company tools; external actions go through the approval outbox.
                The hourly AI limit is shared with the worker.
              </p>
              <button id="chatSend" class="primary">Send to agent</button
              ><span id="chatStatus" role="status"></span>
            </form>
            <div id="messageList" class="stack"></div>
            <button id="olderMessages">Load earlier conversations</button>
            <form id="messageForm">
              <label
                >Message to the project team<textarea
                  id="projectMessage"
                  required
                  minlength="1"
                  maxlength="10000"
                ></textarea></label
              ><button class="primary">Post internal message</button
              ><span id="messageStatus" role="status"></span>
            </form>
          </section>
          <section class="view" id="outbox" hidden>
            <div class="sectionhead">
              <div>
                <p class="eyebrow">EXACT CONTENT / APPROVAL / RECEIPTS</p>
                <h1>Communication you can inspect.</h1>
              </div>
              <div class="actions">
                <button id="newEmail">Draft email</button
                ><button id="newMeeting">Prepare calendar event</button>
              </div>
            </div>
            <p class="muted">
              Only approved exact payloads can be sent. Approval expires after
              24 hours. Uncertain delivery is held for reconciliation, never
              retried automatically. Calendar receipts confirm event creation,
              not that every invitation was delivered.
            </p>
            <div id="outboxList" class="stack"></div>
          </section>
        </div>
        <div id="loading" class="loading">
          Loading the company’s saved records…
        </div>
      </main>
    </div>
    <dialog id="modal">
      <div class="dialoghead">
        <h2 id="modalTitle"></h2>
        <button class="close" aria-label="Close dialog">×</button>
      </div>
      <div id="modalBody"></div>
    </dialog>
    <script nonce="__NONCE__">
      (function () {
        'use strict';
        var state = null,
          token = '',
          busy = false;
        var base = location.pathname.replace(/\/company\/dashboard\/?$/, '');
        var names = {
          customer: 'Customer success',
          quality: 'Quality assurance',
          product: 'Product',
          engineering: 'Engineering',
          operations: 'Operations',
          growth: 'Growth',
          sales: 'Sales',
          finance: 'Finance',
          security: 'Security',
        };
        var labels = {
          queued: 'Queued',
          running: 'In progress',
          review: 'Founder review',
          blocked: 'Blocked',
          completed: 'Accepted',
        };
        function el(tag, cls, text) {
          var n = document.createElement(tag);
          if (cls) n.className = cls;
          if (text !== undefined) n.textContent = text;
          return n;
        }
        function at(id) {
          return document.getElementById(id);
        }
        function clear(n) {
          n.replaceChildren();
          return n;
        }
        function badge(text, type) {
          return el('span', 'badge ' + (type || ''), text);
        }
        function date(v) {
          return new Date(v).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          });
        }
        function button(text, fn, primary) {
          var b = el('button', primary ? 'primary' : '', text);
          b.type = 'button';
          b.addEventListener('click', fn);
          return b;
        }
        function status(text, error) {
          at(error ? 'error' : 'status').textContent = text;
        }
        async function api(path, body) {
          var headers = { 'X-AscendXI-UI': '1' };
          if (token) headers.Authorization = 'Bearer ' + token;
          if (body) headers['Content-Type'] = 'application/json';
          var r = await fetch(base + '/company' + path, {
            method: body ? 'POST' : 'GET',
            headers: headers,
            credentials: 'same-origin',
            body: body ? JSON.stringify(body) : undefined,
          });
          if (r.status === 401 || r.status === 403) {
            at('login').hidden = false;
            at('app').hidden = true;
            throw new Error(
              'Sign in through Studio, or use the private operator API key.',
            );
          }
          var data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Request failed');
          return data;
        }
        async function refresh() {
          if (busy) return false;
          busy = true;
          at('refresh').disabled = true;
          status('Refreshing saved company records…');
          status('', true);
          try {
            state = await api('/state');
            at('app').hidden = false;
            at('login').hidden = true;
            at('loading').hidden = true;
            draw();
            status(
              'Last refreshed ' +
                new Date(state.generatedAt).toLocaleTimeString(),
            );
            return true;
          } catch (e) {
            at('loading').hidden = true;
            status(e.message, true);
            return false;
          } finally {
            busy = false;
            at('refresh').disabled = false;
          }
        }
        function view(id) {
          document.querySelectorAll('.view').forEach(function (n) {
            n.hidden = n.id !== id;
          });
          document.querySelectorAll('nav button').forEach(function (n) {
            n.classList.toggle('active', n.dataset.view === id);
          });
        }
        document.querySelectorAll('[data-view]').forEach(function (n) {
          n.addEventListener('click', function () {
            view(n.dataset.view);
          });
        });
        at('refresh').onclick = refresh;
        at('loginForm').onsubmit = function (e) {
          e.preventDefault();
          token = at('apiKey').value;
          at('apiKey').value = '';
          refresh();
        };
        function counts() {
          var c = {
            queued: 0,
            running: 0,
            review: 0,
            blocked: 0,
            completed: 0,
          };
          (state.taskMetrics || []).forEach(function (r) {
            c[r.status] = (c[r.status] || 0) + Number(r.count);
          });
          if (!state.taskMetrics)
            state.tasks.forEach(function (t) {
              c[t.status]++;
            });
          return c;
        }
        function goalProgress(g) {
          var all = (state.taskMetrics || []).filter(function (r) {
            return r.goal_key === g.key;
          });
          var total = all.reduce(function (n, r) {
              return n + Number(r.count);
            }, 0),
            done = all
              .filter(function (r) {
                return r.status === 'completed';
              })
              .reduce(function (n, r) {
                return n + Number(r.count);
              }, 0);
          return { total: total, done: done };
        }
        function goalCard(g, compact) {
          var card = el('article', compact ? 'goal' : 'panel');
          card.append(el('h3', '', g.title), el('p', '', g.outcome));
          var p = goalProgress(g),
            row = el('div', 'row');
          row.append(
            el(
              'small',
              '',
              (names[g.department] || g.department) + ' / ' + g.product,
            ),
            el(
              'small',
              '',
              p.done + ' of ' + p.total + ' linked tasks accepted',
            ),
          );
          card.append(row);
          var track = el('div', 'progress'),
            fill = el('i');
          fill.style.width = (p.total ? (p.done / p.total) * 100 : 0) + '%';
          track.append(fill);
          card.append(track);
          if (!compact) {
            var ul = el('ul');
            g.acceptance.forEach(function (a) {
              ul.append(el('li', '', a));
            });
            card.append(
              ul,
              button('View linked work', function () {
                at('goalFilter').value = g.key;
                view('workboard');
                drawBoard();
              }),
            );
          }
          return card;
        }
        function draw() {
          var c = counts(),
            verified = state.verifiedKnowledgeCount,
            review = state.knowledge.filter(function (k) {
              return k.status === 'draft' || k.review_due;
            }).length;
          clear(at('stats'));
          [
            [state.goals.length, 'Company goals', 'From founder direction'],
            [c.running + c.queued, 'Open assignments', 'Queued or in progress'],
            [c.review, 'Awaiting acceptance', 'Reports ready for review'],
            [
              verified,
              'Verified records',
              review + ' knowledge items need review',
            ],
          ].forEach(function (x) {
            var n = el('div', 'stat');
            n.append(
              el('span', 'eyebrow', x[1]),
              el('strong', 'number', String(x[0])),
              el('small', '', x[2]),
            );
            at('stats').append(n);
          });
          var configured = state.model.credentialConfigured;
          at('modelBadge').textContent =
            configured === null
              ? 'Provider access unverified'
              : configured
                ? 'Model credential configured'
                : 'Model access pending';
          at('modelBadge').className = 'badge ' + (configured ? '' : 'warning');
          at('modelNotice').hidden = configured !== false;
          at('modelNotice').textContent =
            'Model gateway access is not configured. Company records remain usable; agent generation and assignment runs need the gateway credential.';
          at('agentCount').textContent = state.agentCount + ' agents';
          clear(at('orggroups'));
          Object.entries(state.architecture.orchestrators).forEach(
            function (pair) {
              var group = el('div', 'orggroup');
              group.append(el('h3', '', pair[0] + ' orchestrator'));
              var chips = el('div', 'chips');
              pair[1].forEach(function (id) {
                chips.append(
                  button(names[id] || id, function () {
                    openDepartment(id);
                  }),
                );
              });
              group.append(chips);
              at('orggroups').append(group);
            },
          );
          clear(at('loop'));
          [
            ['queued', 'Assign'],
            ['running', 'Prepare'],
            ['blocked', 'Resolve gaps'],
            ['review', 'Review evidence'],
            ['completed', 'Accept'],
          ].forEach(function (pair) {
            var s = el(
              'div',
              'loopstep ' + (pair[0] === 'review' ? 'attention' : ''),
            );
            s.append(
              el('small', '', pair[1]),
              el('strong', '', String(c[pair[0]])),
              el('p', '', labels[pair[0]]),
            );
            at('loop').append(s);
          });
          clear(at('goalPreview'));
          state.goals.slice(0, 3).forEach(function (g) {
            at('goalPreview').append(goalCard(g, true));
          });
          clear(at('goalsList'));
          state.goals.forEach(function (g) {
            at('goalsList').append(goalCard(g, false));
          });
          clear(at('knowledgePreview'));
          var items = state.knowledge
            .filter(function (k) {
              return k.status === 'draft' || k.review_due;
            })
            .slice(0, 3);
          if (!items.length)
            at('knowledgePreview').append(
              el(
                'p',
                'muted',
                'No knowledge revisions currently need review. Product details without sources remain unknown.',
              ),
            );
          items.forEach(function (k) {
            var r = el('div', 'record');
            r.append(
              el('h3', '', k.title),
              badge(k.status === 'draft' ? 'Draft' : 'Review due', 'warning'),
            );
            r.onclick = function () {
              openKnowledge(k);
            };
            at('knowledgePreview').append(r);
          });
          fillSelect(
            at('departmentFilter'),
            Object.keys(state.departments).map(function (k) {
              return [k, names[k] || k];
            }),
            'All departments',
            true,
          );
          fillSelect(
            at('goalFilter'),
            state.goals.map(function (g) {
              return [g.key, g.title];
            }),
            'All goals',
            true,
          );
          drawIntegrations();
          drawBoard();
          drawKnowledge();
          drawClients();
          drawResources();
          drawActivity();
          drawProjects();
          drawConversations();
          drawOutbox();
          drawWorker();
        }
        function fillSelect(select, items, first, preserve) {
          var before = preserve ? select.value : '';
          clear(select);
          if (first !== null) {
            var o = el('option', '', first);
            o.value = '';
            select.append(o);
          }
          items.forEach(function (pair) {
            var o = el('option', '', pair[1]);
            o.value = pair[0];
            select.append(o);
          });
          select.value = before;
        }
        var studioBase = location.origin.replace(
          '.server.mastra.cloud',
          '.studio.mastra.cloud',
        );
        document.querySelectorAll('.sidefoot a').forEach(function (a) {
          a.href = studioBase + a.getAttribute('href');
        });
        function openDepartment(id) {
          var b = modal(names[id] || id);
          b.append(el('p', '', state.departments[id]));
          var roles = Object.entries(state.roles || {}).filter(function (p) {
            return p[1].department === id;
          });
          roles.forEach(function (p) {
            var r = el('article', 'record');
            r.append(el('h3', '', p[1].name), el('p', '', p[1].mandate));
            var a = el('a', '', 'Open role agent ↗');
            a.href = studioBase + '/agents/' + p[0] + '/threads/new';
            a.target = '_blank';
            a.rel = 'noopener';
            r.append(a);
            b.append(r);
          });
          b.append(
            button('View department work', function () {
              at('departmentFilter').value = id;
              view('workboard');
              drawBoard();
              at('modal').close();
            }),
          );
        }
        function drawBoard() {
          var q = at('taskSearch').value.toLowerCase(),
            d = at('departmentFilter').value,
            g = at('goalFilter').value;
          clear(at('board'));
          Object.keys(labels).forEach(function (statusId) {
            var col = el('section', 'column'),
              tasks = state.tasks.filter(function (t) {
                return (
                  t.status === statusId &&
                  (!q ||
                    (t.title + ' ' + t.objective).toLowerCase().includes(q)) &&
                  (!d || t.department === d) &&
                  (!g || t.goal_key === g)
                );
              });
            var head = el('div', 'columnhead');
            head.append(
              el('span', '', labels[statusId]),
              el('span', '', String(tasks.length)),
            );
            col.append(head);
            if (!tasks.length) col.append(el('p', 'empty', 'No assignments'));
            tasks.forEach(function (t) {
              var card = el('article', 'task ' + t.status);
              card.append(
                el('span', 'eyebrow', t.product),
                el('h3', '', t.title),
                el(
                  'small',
                  '',
                  (names[t.department] || t.department) +
                    ' · attempt ' +
                    t.attempts,
                ),
              );
              card.append(
                button('Inspect assignment', function () {
                  openTask(t);
                }),
              );
              col.append(card);
            });
            at('board').append(col);
          });
        }
        function drawKnowledge() {
          var q = at('knowledgeSearch').value.toLowerCase(),
            filter = at('knowledgeFilter').value;
          clear(at('knowledgeList'));
          state.knowledge
            .filter(function (k) {
              return (
                (!q ||
                  (k.title + ' ' + k.content + ' ' + JSON.stringify(k.sources))
                    .toLowerCase()
                    .includes(q)) &&
                (!filter ||
                  (filter === 'due' ? k.review_due : k.status === filter))
              );
            })
            .forEach(function (k) {
              var row = el('tr', 'clickable');
              var title = el('td');
              title.append(
                button(k.title, function () {
                  openKnowledge(k);
                }),
              );
              row.append(title, el('td', '', k.product));
              var s = el('td');
              s.append(
                badge(
                  k.review_due ? 'Review due' : k.status,
                  k.status === 'draft'
                    ? 'draft'
                    : k.review_due
                      ? 'warning'
                      : '',
                ),
              );
              row.append(
                s,
                el('td', '', 'v' + k.version),
                el('td', '', date(k.created_at)),
              );
              at('knowledgeList').append(row);
            });
        }
        var olderEventRows = [];
        function drawActivity() {
          var all = (state.events || []).concat(olderEventRows),
            seen = new Set(),
            query = at('eventSearch').value.toLowerCase();
          clear(at('activityList'));
          all
            .sort(function (a, b) {
              return Number(b.id) - Number(a.id);
            })
            .forEach(function (i) {
              if (seen.has(i.id)) return;
              seen.add(i.id);
              if (
                (i.kind + ' ' + i.actor + ' ' + i.summary)
                  .toLowerCase()
                  .indexOf(query) < 0
              )
                return;
              var row = el('article', 'panel');
              row.append(
                el('p', 'date', new Date(i.created_at).toLocaleString()),
                el('h3', '', i.summary),
                badge(i.kind, 'neutral'),
                el('p', 'muted', i.actor),
              );
              if (i.data && Object.keys(i.data).length) {
                var details = el('details'),
                  summary = el('summary', '', 'Inspect saved evidence');
                details.append(
                  summary,
                  el('pre', 'content', JSON.stringify(i.data, null, 2)),
                );
                row.append(details);
              }
              at('activityList').append(row);
            });
          if (!all.length)
            at('activityList').append(
              el('p', 'empty', 'No events have been recorded yet.'),
            );
        }
        at('eventSearch').addEventListener('input', drawActivity);
        at('olderEvents').onclick = async function () {
          var all = (state.events || []).concat(olderEventRows),
            before = all.reduce(function (n, e) {
              return Math.min(n, Number(e.id));
            }, Number.MAX_SAFE_INTEGER);
          try {
            var rows = await api('/events?before=' + before);
            olderEventRows = olderEventRows.concat(rows);
            drawActivity();
            status(
              rows.length ? 'Earlier events loaded' : 'No earlier events.',
            );
          } catch (e) {
            status(e.message, true);
          }
        };
        ['taskSearch', 'departmentFilter', 'goalFilter'].forEach(function (id) {
          at(id).addEventListener('input', drawBoard);
        });
        ['knowledgeSearch', 'knowledgeFilter'].forEach(function (id) {
          at(id).addEventListener('input', drawKnowledge);
        });
        function modal(title) {
          at('modalTitle').textContent = title;
          clear(at('modalBody'));
          at('modal').showModal();
          return at('modalBody');
        }
        at('modal').querySelector('.close').onclick = function () {
          at('modal').close();
        };
        function input(form, label, type, value) {
          var l = el('label', '', label),
            n = el(
              type === 'textarea'
                ? 'textarea'
                : type === 'select'
                  ? 'select'
                  : 'input',
            );
          if (type !== 'textarea' && type !== 'select') n.type = type || 'text';
          if (value !== undefined && value !== null) n.value = value;
          n.setAttribute('aria-label',label);
          l.append(n);
          form.append(l);
          return n;
        }
        function formSave(form, label, handler) {
          var error = el('p', '', '');
          error.setAttribute('role', 'alert');
          form.append(error);
          var submit = el('button', 'primary', label);
          submit.type = 'submit';
          form.append(submit);
          form.onsubmit = async function (e) {
            e.preventDefault();
            submit.disabled = true;
            error.textContent = 'Saving…';
            try {
              await handler();
              at('modal').close();
              await refresh();
            } catch (err) {
              error.textContent = err.message;
            } finally {
              submit.disabled = false;
            }
          };
        }
        function openTask(t) {
          var b = modal(t.title);
          b.append(
            badge(labels[t.status], t.status === 'blocked' ? 'warning' : ''),
            el(
              'p',
              'muted',
              (t.specialist && state.roles[t.specialist]
                ? state.roles[t.specialist].name
                : names[t.department]) +
                ' / ' +
                t.product,
            ),
            el('p', '', t.objective),
          );
          var ul = el('ul');
          t.acceptance.forEach(function (a) {
            ul.append(el('li', '', a));
          });
          b.append(
            el('h3', '', 'Acceptance criteria'),
            ul,
            el('p', 'date', 'Task ' + t.id),
          );
          if (t.report) {
            var report = t.report.report || t.report;
            b.append(el('h3', '', 'Saved report and review'),el('p','muted','Retained document · '+new Date(t.updated_at).toLocaleString()+'. Current operating controls shown on the live desk take precedence over historical throughput notes. This report is not a deployment receipt.'));
            if (report.deliverable)
              b.append(el('div', 'content', report.deliverable));
            if (report.error) b.append(el('p', 'notice', report.error));
            ['evidence', 'blockers', 'limitations'].forEach(function (key) {
              if (report[key] && report[key].length) {
                b.append(
                  el('h3', '', stageName(key)),
                );
                report[key].forEach(function (text) {
                  b.append(el('p', '', text));
                });
              }
            });
            if (t.report.review) {
              b.append(
                el('h3', '', 'Independent quality review'),
                badge(
                  t.report.review.accepted ? 'Review passed' : 'Changes needed',
                  t.report.review.accepted ? '' : 'warning',
                ),
              );
              t.report.review.findings
                .concat(t.report.review.evidenceGaps, t.report.review.limitations || [])
                .forEach(function (text) {
                  b.append(el('p', '', text));
                });
            }
            if (report.nextAction)
              b.append(
                el('h3', '', 'Next action'),
                el('p', '', report.nextAction),
              );
          }
          if(t.status === 'blocked') b.prepend(button('Resolve blocker · next actions',function(){inspectBlocker(t.id);}));
          var actions = el('div', 'actions');
          if (t.status === 'queued') {
            var run = button(
              'Run department + quality review',
              async function () {
                run.disabled = true;
                run.textContent = 'Running assignment…';
                try {
                  await api('/tasks/' + t.id + '/run', {});
                  at('modal').close();
                  await refresh();
                } catch (e) {
                  status(e.message, true);
                  run.disabled = false;
                  run.textContent = 'Run department + quality review';
                }
              },
            );
            run.disabled = state.model.credentialConfigured === false;
            actions.append(run);
          }
          if (t.status === 'review' || t.status === 'blocked') {
            actions.append(
              button('Request another attempt', function () {
                decide(t, 'retry');
              }),
            );
            if (t.status === 'review')
              actions.append(
                button(
                  'Accept deliverable',
                  function () {
                    decide(t, 'complete');
                  },
                  true,
                ),
              );
          }
          b.append(actions);
        }
        function decide(t, decision) {
          var b = modal(
            decision === 'complete'
              ? 'Accept this deliverable?'
              : 'Retry this assignment?',
          );
          b.append(
            el('p', '', t.title),
            el(
              'p',
              'muted',
              'This records your explicit internal decision. It does not approve or perform an external action.',
            ),
          );
          var f = el('form'),
            evidence = input(f, 'Review evidence or reason', 'textarea');
          evidence.required = true;
          evidence.minLength = 10;
          formSave(
            f,
            decision === 'complete' ? 'Confirm acceptance' : 'Confirm retry',
            function () {
              return api('/tasks/' + t.id + '/decision', {
                decision: decision,
                evidence: evidence.value,
              });
            },
          );
          b.append(f);
        }
        at('newTask').onclick = function () {
          var b = modal('Create a scoped assignment'),
            f = el('form');
          var title = input(f, 'Assignment title', 'text');
          title.required = true;
          var obj = input(f, 'Measurable objective', 'textarea');
          obj.required = true;
          var product = input(f, 'Product', 'select');
          fillSelect(
            product,
            state.products.map(function (p) {
              return [p, p];
            }),
            null,
          );
          product.value = 'AscendXI';
          var dep = input(f, 'Responsible department', 'select');
          fillSelect(
            dep,
            Object.keys(state.departments).map(function (d) {
              return [d, names[d] || d];
            }),
            null,
          );
          dep.value = 'operations';
          var specialist = input(f, 'Specialist owner · optional', 'select');
          function roleOptions() {
            fillSelect(
              specialist,
              Object.entries(state.roles || {})
                .filter(function (p) {
                  return p[1].department === dep.value;
                })
                .map(function (p) {
                  return [p[0], p[1].name];
                }),
              'Department lead',
            );
          }
          dep.addEventListener('change', roleOptions);
          roleOptions();
          var goal = input(f, 'Company goal', 'select');
          fillSelect(
            goal,
            state.goals.map(function (g) {
              return [g.key, g.title];
            }),
            'No goal selected',
          );
          var acceptance = input(
            f,
            'Acceptance criteria · one per line',
            'textarea',
          );
          acceptance.required = true;
          formSave(f, 'Save assignment', function () {
            return api('/tasks', {
              key: 'desk-' + crypto.randomUUID(),
              title: title.value,
              objective: obj.value,
              product: product.value,
              department: dep.value,
              specialist: specialist.value || null,
              goal_key: goal.value || null,
              acceptance: acceptance.value
                .split('\n')
                .map(function (x) {
                  return x.trim();
                })
                .filter(Boolean),
            });
          });
          b.append(f);
        };
        async function openKnowledge(k) {
          var b = modal(k.title);
          b.append(
            badge(k.status, k.status === 'draft' ? 'draft' : ''),
            el(
              'p',
              'date',
              k.product +
                ' · revision ' +
                k.version +
                ' · review by ' +
                date(k.review_after),
            ),
            el('div', 'content', k.content),
            el('h3', '', 'Sources'),
          );
          k.sources.forEach(function (s) {
            b.append(el('p', 'source', s.kind + ' / ' + s.reference));
          });
          var actions = el('div', 'actions');
          actions.append(
            button('Propose an update', function () {
              editKnowledge(k);
            }),
          );
          if (k.status === 'draft')
            actions.append(
              button(
                'Review & publish',
                function () {
                  var body = modal('Publish this exact revision?');
                  body.append(
                    el('p', '', k.title + ' / v' + k.version),
                    el('div', 'content', k.content),
                    el(
                      'p',
                      'muted',
                      'Confirm that the sources support this record. Publishing creates a new verified revision; earlier versions stay available.',
                    ),
                    button(
                      'Publish verified revision',
                      async function () {
                        try {
                          await api('/knowledge/' + k.slug + '/publish', {
                            expectedVersion: k.version,
                          });
                          at('modal').close();
                          await refresh();
                        } catch (e) {
                          status(e.message, true);
                        }
                      },
                      true,
                    ),
                  );
                },
                true,
              ),
            );
          b.append(actions, el('h3', '', 'Revision history'));
          var history = el('div');
          b.append(history);
          try {
            var versions = await api('/knowledge/' + k.slug + '/history');
            versions.forEach(function (v) {
              history.append(
                button(
                  'v' +
                    v.version +
                    ' · ' +
                    v.status +
                    ' · ' +
                    date(v.created_at),
                  function () {
                    openKnowledge(v);
                  },
                ),
              );
            });
          } catch (e) {
            history.textContent = e.message;
          }
        }
        function editKnowledge(k) {
          var b = modal(
              k ? 'Propose knowledge revision' : 'Add sourced knowledge',
            ),
            f = el('form');
          var title = input(f, 'Record title', 'text', k && k.title);
          title.required = true;
          var slug = input(
            f,
            'Stable key · lowercase words with hyphens',
            'text',
            k && k.slug,
          );
          slug.required = true;
          slug.pattern = '[a-z0-9]+(-[a-z0-9]+)*';
          slug.disabled = !!k;
          var product = input(f, 'Product', 'select');
          fillSelect(
            product,
            state.products.map(function (p) {
              return [p, p];
            }),
            null,
          );
          product.value = k ? k.product : 'AscendXI';
          var content = input(
            f,
            'Company knowledge',
            'textarea',
            k && k.content,
          );
          content.required = true;
          content.minLength = 10;
          content.rows = 9;
          var source = input(
            f,
            'Source references · one per line',
            'textarea',
            k &&
              k.sources
                .map(function (s) {
                  return s.reference;
                })
                .join('\n'),
          );
          source.required = true;
          f.append(
            el(
              'p',
              'muted',
              'Updates save as drafts. Publishing requires a separate review of the exact revision.',
            ),
          );
          formSave(f, 'Save draft revision', function () {
            return api('/knowledge', {
              slug: slug.value,
              title: title.value,
              product: product.value,
              content: content.value,
              expectedVersion: k ? k.version : 0,
              sources: source.value
                .split('\n')
                .map(function (s) {
                  return s.trim();
                })
                .filter(Boolean)
                .map(function (s) {
                  return { kind: 'founder', reference: s };
                }),
            });
          });
          b.append(f);
        }
        at('newKnowledge').onclick = function () {
          editKnowledge(null);
        };
        at('newGoal').onclick = function () {
          var b = modal('Set a company goal'),
            f = el('form'),
            title = input(f, 'Goal title', 'text');
          title.required = true;
          var key = input(f, 'Stable goal key', 'text');
          key.required = true;
          key.pattern = '[a-z0-9]+(-[a-z0-9]+)*';
          var outcome = input(f, 'Desired outcome', 'textarea');
          outcome.required = true;
          outcome.minLength = 10;
          var product = input(f, 'Product', 'select');
          fillSelect(
            product,
            state.products.map(function (p) {
              return [p, p];
            }),
            null,
          );
          product.value = 'AscendXI';
          var department = input(f, 'Accountable department', 'select');
          fillSelect(
            department,
            Object.keys(state.departments).map(function (d) {
              return [d, names[d] || d];
            }),
            null,
          );
          department.value = 'operations';
          var criteria = input(
            f,
            'Acceptance criteria · one per line',
            'textarea',
          );
          criteria.required = true;
          formSave(f, 'Save company goal', function () {
            return api('/goals', {
              key: key.value,
              title: title.value,
              outcome: outcome.value,
              product: product.value,
              department: department.value,
              acceptance: criteria.value
                .split('\n')
                .map(function (x) {
                  return x.trim();
                })
                .filter(Boolean),
            });
          });
          b.append(f);
        };

        function stageName(s) {
          return s.charAt(0).toUpperCase() + s.slice(1);
        }
        function drawIntegrations() {
          clear(at('integrations'));
          (state.integrations || []).forEach(function (i) {
            var row = el('div', 'row');
            row.append(
              el('strong', '', i.service),
              badge(i.status, i.status === 'verified' ? '' : 'warning'),
              el(
                'small',
                '',
                i.checked_at ? date(i.checked_at) : 'Not checked',
              ),
            );
            at('integrations').append(row);
          });
        }
        at('verifyConnections').onclick = async function () {
          var b = at('verifyConnections');
          b.disabled = true;
          status('Checking existing service connections with read-only calls…');
          try {
            await api('/integrations/verify', {});
            await refresh();
          } catch (e) {
            status(e.message, true);
          } finally {
            b.disabled = false;
          }
        };
        function drawClients() {
          clear(at('pipeline'));
          state.stages
            .filter(function (s) {
              return s !== 'lost';
            })
            .forEach(function (s) {
              var n = el('div', 'loopstep');
              n.append(
                el('small', '', stageName(s)),
                el(
                  'strong',
                  '',
                  String(
                    state.opportunities.filter(function (o) {
                      return o.stage === s;
                    }).length,
                  ),
                ),
              );
              at('pipeline').append(n);
            });
          clear(at('clientList'));
          if (!state.opportunities.length)
            at('clientList').append(
              el(
                'p',
                'empty',
                'No sourced opportunities have been saved. Add a verified business lead, or ask the lead researcher to work from an approved customer profile.',
              ),
            );
          state.opportunities.forEach(function (o) {
            var n = el('article', 'panel');
            var row = el('div', 'row');
            row.append(
              el('h3', '', o.company),
              badge(stageName(o.stage), 'neutral'),
            );
            n.append(
              row,
              el('p', '', o.need),
              el('p', 'source', o.source),
              button('Inspect opportunity', function () {
                openClient(o);
              }),
            );
            at('clientList').append(n);
          });
          clear(at('estimateList'));
          if (!state.estimates.length)
            at('estimateList').append(
              el(
                'p',
                'empty',
                'No estimates yet. Start from an opportunity and verified resource inputs.',
              ),
            );
          state.estimates.forEach(function (e) {
            var r = e.report,
              n = el('article', 'panel');
            n.append(
              el(
                'h3',
                '',
                (
                  state.opportunities.find(function (o) {
                    return o.key === e.opportunity_key;
                  }) || {}
                ).company || 'Saved opportunity',
              ),
              badge(r.status, r.status === 'blocked' ? 'warning' : 'draft'),
              el(
                'p',
                '',
                r.effortHours.low +
                  '–' +
                  r.effortHours.high +
                  ' scoped effort hours',
              ),
            );
            if (r.cost)
              n.append(
                el(
                  'p',
                  '',
                  r.cost.currency +
                    ' ' +
                    r.cost.low +
                    '–' +
                    r.cost.high +
                    ' / ' +
                    r.durationWeeks.low +
                    '–' +
                    r.durationWeeks.high +
                    ' capacity weeks',
                ),
              );
            r.blockers.forEach(function (b) {
              n.append(el('p', '', b));
            });
            n.append(
              button('Inspect estimate', function () {
                var body = modal('Estimate assumptions');
                body.append(el('h3', '', 'Scoped effort'));
                r.items.forEach(function (i) {
                  body.append(
                    el(
                      'p',
                      '',
                      i.scope +
                        ' / ' +
                        i.resourceKey +
                        ' / ' +
                        i.lowHours +
                        '–' +
                        i.highHours +
                        ' hours',
                    ),
                  );
                });
                body.append(el('h3', '', 'Assumptions'));
                r.assumptions.forEach(function (a) {
                  body.append(el('p', '', a));
                });
                (r.resourceSnapshot || []).forEach(function (s) {
                  body.append(
                    el(
                      'p',
                      'source',
                      s.key + ' / revision ' + s.version + ' / ' + s.source,
                    ),
                  );
                });
              }),
            );
            at('estimateList').append(n);
          });
        }
        function openClient(o) {
          var b = modal(o.company);
          b.append(
            badge(stageName(o.stage), 'neutral'),
            el('p', '', o.need),
            el('p', 'source', o.source),
            el(
              'p',
              '',
              o.contact_email || 'No business contact email recorded.',
            ),
          );
          var actions = el('div', 'actions');
          if (o.stage !== 'lost')
            actions.append(
              button('Create current-stage assignment', async function () {
                try {
                  var task = await api(
                    '/leads/' + encodeURIComponent(o.key) + '/assignment',
                    {},
                  );
                  await refresh();
                  openTask(task);
                } catch (e) {
                  status(e.message, true);
                }
              }),
            );
          actions.append(
            button('Prepare resource-based estimate', function () {
              newEstimate(o);
            }),
          );
          if (o.stage !== 'support' && o.stage !== 'lost')
            actions.append(
              button('Record stage change', function () {
                var body = modal('Record a client stage change'),
                  f = el('form');
                body.append(
                  el('p', '', o.company + ' / currently ' + stageName(o.stage)),
                  el(
                    'p',
                    'muted',
                    'Record only evidence-backed internal progress. This action does not send messages, book meetings or accept contracts.',
                  ),
                );
                var next = input(f, 'Next stage', 'select'),
                  index = state.stages.indexOf(o.stage),
                  options = [];
                if (state.stages[index + 1] !== 'lost')
                  options.push([
                    state.stages[index + 1],
                    stageName(state.stages[index + 1]),
                  ]);
                if (index < 6) options.push(['lost', 'Lost / not proceeding']);
                fillSelect(next, options, null);
                if (options.length) next.value = options[0][0];
                var evidence = input(f, 'Evidence and handoff', 'textarea');
                evidence.required = true;
                evidence.minLength = 10;
                formSave(f, 'Record reviewed stage change', function () {
                  return api(
                    '/leads/' + encodeURIComponent(o.key) + '/advance',
                    {
                      expectedStage: o.stage,
                      nextStage: next.value,
                      evidence: evidence.value,
                    },
                  );
                });
                body.append(f);
              }),
            );
          b.append(actions, el('h3', '', 'Stage history'));
          if (!o.history.length)
            b.append(
              el(
                'p',
                'muted',
                'Research record created; no stage changes yet.',
              ),
            );
          o.history.forEach(function (h) {
            b.append(
              el(
                'p',
                '',
                stageName(h.from) +
                  ' → ' +
                  stageName(h.to) +
                  ' / ' +
                  h.evidence,
              ),
            );
          });
        }
        at('newLead').onclick = function () {
          var b = modal('Add a sourced business lead'),
            f = el('form'),
            company = input(f, 'Company or business name', 'text');
          company.required = true;
          var email = input(
              f,
              'Known business contact email · optional',
              'email',
            ),
            need = input(
              f,
              'Observed need or reason for qualification',
              'textarea',
            );
          need.required = true;
          need.minLength = 10;
          var source = input(f, 'Actual source reference', 'textarea');
          source.required = true;
          source.minLength = 3;
          var product = input(f, 'Relevant company or product', 'select');
          fillSelect(
            product,
            state.products.map(function (p) {
              return [p, p];
            }),
            null,
          );
          product.value = 'AscendXI';
          f.append(
            el(
              'p',
              'muted',
              'No message is sent. Contact details and claims must come from the cited source.',
            ),
          );
          formSave(f, 'Save research lead', function () {
            return api('/leads', {
              key: 'lead-' + crypto.randomUUID(),
              company: company.value,
              contactEmail: email.value || null,
              need: need.value,
              source: source.value,
              product: product.value,
            });
          });
          b.append(f);
        };
        function drawResources() {
          clear(at('resourceList'));
          if (!state.resources.length)
            at('resourceList').append(
              el(
                'p',
                'empty',
                'No measured resource assumptions are recorded. Add verified human or AI capacity and cost evidence before using it for client estimates.',
              ),
            );
          state.resources.forEach(function (r) {
            var n = el('article', 'panel'),
              row = el('div', 'row');
            row.append(
              el('h3', '', r.name),
              badge(
                r.verified ? 'Reviewed inputs' : 'Proposed inputs',
                r.verified ? '' : 'draft',
              ),
            );
            n.append(
              row,
              el('p', '', r.capabilities.join(' · ')),
              el(
                'p',
                '',
                r.availableHoursPerWeek === null
                  ? 'Weekly capacity unknown'
                  : r.availableHoursPerWeek + ' available hours per week',
              ),
              el(
                'p',
                '',
                r.ratePerHour === null
                  ? 'Cost rate unknown'
                  : r.currency + ' ' + r.ratePerHour + ' per hour',
              ),
              el('p', 'source', r.source),
            );
            var actions = el('div', 'actions');
            actions.append(
              button('Update assumptions', function () {
                editResource(r);
              }),
            );
            if (!r.verified) {
              var verify = button('Review this resource', function () {
                var body = modal('Verify resource assumptions');
                body.append(
                  el('p', '', r.name + ' / revision ' + r.version),
                  el(
                    'p',
                    '',
                    r.availableHoursPerWeek + ' available hours per week',
                  ),
                  el('p', 'source', r.source),
                  el(
                    'p',
                    'muted',
                    'Confirm that these assumptions reflect actual current availability. Registration alone does not measure agent throughput.',
                  ),
                  button(
                    'Confirm reviewed resource',
                    async function () {
                      try {
                        await api(
                          '/resources/' + encodeURIComponent(r.key) + '/verify',
                          {
                            expectedVersion: r.version,
                          },
                        );
                        at('modal').close();
                        await refresh();
                      } catch (e) {
                        status(e.message, true);
                      }
                    },
                    true,
                  ),
                );
              });
              verify.disabled = r.availableHoursPerWeek === null;
              actions.append(verify);
            }
            n.append(actions);
            at('resourceList').append(n);
          });
        }
        function editResource(r) {
          var b = modal(
              r ? 'Update resource assumptions' : 'Record a resource',
            ),
            f = el('form'),
            name = input(f, 'Resource name', 'text', r && r.name);
          name.required = true;
          var key = input(f, 'Stable resource key', 'text', r && r.key);
          key.required = true;
          key.pattern = '[a-z0-9]+(-[a-z0-9]+)*';
          key.disabled = !!r;
          var caps = input(
            f,
            'Capabilities · comma separated',
            'text',
            r && r.capabilities.join(', '),
          );
          caps.required = true;
          var hours = input(
            f,
            'Actual available hours per week · leave blank if unknown',
            'number',
            r && r.availableHoursPerWeek,
          );
          hours.min = '0.01';
          hours.max = '168';
          hours.step = '0.01';
          var rate = input(
            f,
            'Cost per hour · leave blank if unknown',
            'number',
            r && r.ratePerHour,
          );
          rate.min = '0';
          rate.step = '0.01';
          var currency = input(
            f,
            'Currency code · e.g. INR, USD, EUR',
            'text',
            r && r.currency,
          );
          currency.required = true;
          currency.pattern = '[A-Z]{3}';
          var source = input(
            f,
            'Source for capacity and cost assumptions',
            'textarea',
            r && r.source,
          );
          source.required = true;
          source.minLength = 3;
          formSave(f, 'Save proposed resource', function () {
            return api('/resources', {
              key: key.value,
              name: name.value,
              capabilities: caps.value
                .split(',')
                .map(function (v) {
                  return v.trim();
                })
                .filter(Boolean),
              availableHoursPerWeek:
                hours.value === '' ? null : Number(hours.value),
              ratePerHour: rate.value === '' ? null : Number(rate.value),
              currency: currency.value,
              source: source.value,
              expectedVersion: r ? r.version : 0,
            });
          });
          b.append(f);
        }
        at('newResource').onclick = function () {
          editResource(null);
        };
        function newEstimate(o) {
          var b = modal('Prepare a scoped estimate'),
            f = el('form');
          b.append(
            el('p', '', o.company),
            el(
              'p',
              'muted',
              'Enter scoped effort ranges. Missing, unreviewed or stale capacity/rates produce blockers. Duration assumes resources can work in parallel.',
            ),
          );
          if (!state.resources.length) {
            b.append(
              el(
                'p',
                'notice',
                'Add resource assumptions before preparing an estimate.',
              ),
              button('Add a resource', function () {
                editResource(null);
              }),
            );
            return;
          }
          var rows = el('div', 'stack'),
            inputs = [];
          function addItem() {
            var group = el('section', 'panel'),
              resource = input(group, 'Assigned resource', 'select');
            fillSelect(
              resource,
              state.resources.map(function (r) {
                return [r.key, r.name + (r.verified ? '' : ' / proposed')];
              }),
              null,
            );
            resource.value = state.resources[0].key;
            var scope = input(group, 'Scoped work item', 'text');
            scope.required = true;
            scope.minLength = 5;
            var low = input(group, 'Low effort hours', 'number'),
              high = input(group, 'High effort hours', 'number');
            [low, high].forEach(function (n) {
              n.required = true;
              n.min = '0.01';
              n.step = '0.01';
            });
            inputs.push({
              resource: resource,
              scope: scope,
              low: low,
              high: high,
            });
            rows.append(group);
          }
          addItem();
          f.append(rows, button('Add another work item', addItem));
          formSave(f, 'Calculate and save draft', function () {
            return api('/estimates', {
              opportunityKey: o.key,
              items: inputs.map(function (i) {
                return {
                  resourceKey: i.resource.value,
                  scope: i.scope.value,
                  lowHours: Number(i.low.value),
                  highHours: Number(i.high.value),
                };
              }),
            });
          });
          b.append(f);
        }

        function drawWorker() {
          var w = state.worker || {};
          at('workerStatus').hidden = !state.localMode;
          at('workerStatus').textContent = state.localMode
            ? w.alive
              ? 'Worker online · ' + (w.active_task ? 'assignment in progress' : 'monitoring the queue')
              : 'Local worker heartbeat is missing or stale. Inspect local service logs.'
            : 'Local worker not enabled on this host.';
        }
        function drawProjects() {
          clear(at('projectList'));
          (state.projects || []).forEach(function (p) {
            var n = el('article', 'panel'),
              row = el('div', 'row');
            row.append(
              el('h2', '', p.name),
              badge(
                p.paused ? 'Paused' : p.ready ? 'Active' : 'Preparing',
                p.paused ? 'warning' : '',
              ),
            );
            n.append(
              row,
              badge(
                p.kind === 'internal'
                  ? 'Internal company project'
                  : 'Client project',
                'neutral',
              ),
              el('p', '', p.brief),
              el('p', 'source', p.award_evidence),
              el(
                'p',
                'muted',
                p.auto_accept_artifacts
                  ? 'Reviewed internal artifacts may be accepted under this project charter. External actions still need separate approval.'
                  : 'Internal artifacts wait for operator acceptance.',
              ),
            );
            var complete = p.steps.filter(function (t) {
              return t.status === 'completed';
            }).length;
            n.append(
              el(
                'p',
                '',
                complete +
                  ' of ' +
                  p.steps.length +
                  ' internal handoffs accepted',
              ),
            );
            var list = el('div', 'stack');
            p.steps.forEach(function (t) {
              var r = el('div', 'row');
              r.append(
                el('span', '', t.title),
                badge(
                  labels[t.status] || t.status,
                  t.status === 'blocked' ? 'warning' : 'neutral',
                ),
                button('Inspect', function () {
                  var task = state.tasks.find(function (x) {
                    return x.id === t.taskId;
                  });
                  if (task) openTask(task);
                  else
                    api('/tasks/' + t.taskId)
                      .then(openTask)
                      .catch(function (e) {
                        status(e.message, true);
                      });
                }),
              );
              list.append(r);
            });
            n.append(list);
            var actions = el('div', 'actions');
            actions.append(
              button('Source & evidence artifacts', async function () {
                try {
                  var body = modal('Project source & evidence'),
                    records = await api('/projects/' + p.id + '/artifacts');
                  body.append(
                    el(
                      'p',
                      'muted',
                      'These are saved text snapshots that agents can read within this project. They do not grant filesystem execution or prove that code was deployed.',
                    ),
                  );
                  records.forEach(function (a) {
                    var box = el('article', 'panel');
                    box.append(
                      el('h3', '', a.path),
                      el('p', 'source', a.source),
                      el('p', 'source', 'SHA-256 ' + a.hash),
                      button('Read saved snapshot', async function () {
                        try {
                          var record = await api(
                            '/projects/' +
                              p.id +
                              '/artifact?path=' +
                              encodeURIComponent(a.path),
                          );
                          var contentBody = modal(record.path);
                          contentBody.append(
                            el('p', 'source', record.source),
                            el('pre', 'content', record.content),
                          );
                        } catch (e) {
                          status(e.message, true);
                        }
                      }),
                    );
                    body.append(box);
                  });
                  var f = el('form'),
                    path = input(f, 'Relative artifact name', 'text'),
                    content = input(
                      f,
                      'Actual text content (maximum 50,000 characters)',
                      'textarea',
                    ),
                    source = input(
                      f,
                      'Source / revision / evidence reference',
                      'text',
                    );
                  path.required = true;
                  content.required = true;
                  content.maxLength = 50000;
                  source.required = true;
                  source.minLength = 3;
                  formSave(f, 'Save evidence snapshot', function () {
                    return api('/projects/' + p.id + '/artifact', {
                      path: path.value,
                      content: content.value,
                      source: source.value,
                    });
                  });
                  body.append(f);
                } catch (e) {
                  status(e.message, true);
                }
              }),
              button('Open project room', function () {
                at('conversationProject').value = p.id;
                drawConversations();
                view('conversations');
              }),
              button(
                p.paused ? 'Resume project' : 'Pause project',
                async function () {
                  try {
                    await api('/projects/' + p.id + '/pause', {
                      paused: !p.paused,
                    });
                    await refresh();
                  } catch (e) {
                    status(e.message, true);
                  }
                },
              ),
            );
            n.append(actions);
            at('projectList').append(n);
          });
          if (!(state.projects || []).length)
            at('projectList').append(
              el(
                'p',
                'empty',
                'No awarded projects yet. Start with a real won opportunity, its approved brief and award evidence.',
              ),
            );
          fillSelect(
            at('conversationProject'),
            (state.projects || []).map(function (p) {
              return [p.id, p.name];
            }),
            'All visible conversations',
            true,
          );
        }
        var historicalMessages = [];
        var chatRunning = false;
        function drawConversations() {
          var agentBefore = at('chatAgent').value;
          fillSelect(
            at('chatAgent'),
            [
              ['agent', 'AI Co-Founder'],
              ['delivery', 'Delivery orchestrator'],
              ['commercial', 'Commercial orchestrator'],
            ]
              .concat(
                Object.keys(state.departments).map(function (k) {
                  return [k, names[k] || k];
                }),
              )
              .concat(
                Object.entries(state.roles).map(function (p) {
                  return [p[0], p[1].name];
                }),
              ),
            null,
          );
          at('chatAgent').value = agentBefore || 'agent';
          at('chatSend').disabled =
            chatRunning || state.model.credentialConfigured === false;

          var project = at('conversationProject').value;
          clear(at('messageList'));
          var seenMessages = new Set();
          var rows = (state.messages || [])
            .concat(historicalMessages)
            .filter(function (m) {
              if (seenMessages.has(m.id)) return false;
              seenMessages.add(m.id);
              return true;
            })
            .sort(function (a, b) {
              return Number(b.id) - Number(a.id);
            })
            .filter(function (m) {
              return !project || m.project_id === project;
            })
            .slice()
            .reverse();
          rows.forEach(function (m) {
            var n = el('article', 'panel'),
              r = el('div', 'row');
            r.append(
              el('h3', '', m.speaker),
              badge(m.channel, 'neutral'),
              el('small', '', new Date(m.created_at).toLocaleString()),
            );
            n.append(r);
            var structured = null;
            try {
              if (['deliverable', 'review'].includes(m.channel))
                structured = JSON.parse(m.content);
            } catch (e) {}
            var preview = structured?.deliverable || (typeof structured?.accepted === 'boolean' ? (structured.accepted ? 'Quality review passed' : 'Changes needed') + ' · ' + (structured.findings?.[0] || '') : m.content);
            n.append(el('p', '', preview.slice(0, 220) + (preview.length > 220 ? '…' : '')));
            var detail = el('details');
            detail.append(el('summary', '', 'Inspect message & evidence'));
            if (structured) {
              if (structured.deliverable)
                detail.append(el('div', 'content', structured.deliverable));
              if (typeof structured.accepted === 'boolean')
                detail.append(
                  badge(
                    structured.accepted
                      ? 'Quality review passed'
                      : 'Changes needed',
                    structured.accepted ? '' : 'warning',
                  ),
                );
              ['evidence', 'blockers', 'findings', 'evidenceGaps', 'limitations'].forEach(
                function (k) {
                  if (structured[k] && structured[k].length) {
                    detail.append(
                      el(
                        'h3',
                        '',
                        k === 'evidenceGaps' ? 'Evidence gaps' : stageName(k),
                      ),
                    );
                    structured[k].forEach(function (text) {
                      detail.append(el('p', '', text));
                    });
                  }
                },
              );
              if (structured.nextAction)
                detail.append(el('p', '', structured.nextAction));
            } else detail.append(el('div', 'content', m.content));
            detail.append(el('p', 'source', m.source));
            n.append(detail);
            at('messageList').append(n);
          });
          if (!rows.length)
            at('messageList').append(
              el(
                'p',
                'empty',
                'No saved conversation outputs for this selection.',
              ),
            );
          at('messageForm').hidden = !project;
        }
        at('conversationProject').onchange = drawConversations;
        at('olderMessages').onclick = async function () {
          try {
            var project = at('conversationProject').value;
            var all = (state.messages || [])
              .concat(historicalMessages)
              .filter(function (m) {
                return !project || m.project_id === project;
              });
            var before = all.length
              ? String(
                  Math.min.apply(
                    null,
                    all.map(function (m) {
                      return Number(m.id);
                    }),
                  ),
                )
              : '9223372036854775807';
            var rows = await api(
              '/messages?before=' +
                before +
                (project ? '&projectId=' + project : ''),
            );
            historicalMessages = historicalMessages.concat(rows);
            drawConversations();
            this.textContent = rows.length
              ? 'Load earlier conversations'
              : 'No earlier conversations';
          } catch (e) {
            status(e.message, true);
          }
        };
        at('chatForm').onsubmit = async function (e) {
          e.preventDefault();
          if (chatRunning) return;
          chatRunning = true;
          at('chatSend').disabled = true;
          at('chatStatus').textContent =
            'Agent is working. Its response will be saved here…';
          try {
            await api('/chat', {
              agentId: at('chatAgent').value,
              projectId: at('conversationProject').value || null,
              message: at('chatMessage').value,
            });
            at('chatMessage').value = '';
            await refresh();
            at('chatStatus').textContent = 'Response saved below.';
          } catch (err) {
            at('chatStatus').textContent = err.message;
            await refresh();
          } finally {
            chatRunning = false;
            at('chatSend').disabled = false;
          }
        };
        at('messageForm').onsubmit = async function (e) {
          e.preventDefault();
          var b = this.querySelector('button');
          b.disabled = true;
          try {
            await api('/messages', {
              projectId: at('conversationProject').value,
              content: at('projectMessage').value,
            });
            at('projectMessage').value = '';
            await refresh();
            at('messageStatus').textContent =
              'Message saved for the project team.';
          } catch (err) {
            at('messageStatus').textContent = err.message;
          } finally {
            b.disabled = false;
          }
        };
        at('newProject').onclick = function () {
          var body = modal('Record an approved project'),
            f = el('form');
          var kind = input(f, 'Project type', 'select');
          fillSelect(
            kind,
            [
              ['client', 'Awarded client project'],
              ['internal', 'Founder-approved internal project'],
            ],
            null,
          );
          kind.value = 'client';
          var leads = state.opportunities.filter(function (o) {
            return [
              'won',
              'delivery',
              'quality',
              'handoff',
              'support',
            ].includes(o.stage);
          });
          var client = input(
            f,
            'Won opportunity · required for client projects',
            'select',
          );
          fillSelect(
            client,
            leads.map(function (l) {
              return [l.key, l.company];
            }),
            null,
          );
          if (leads.length) client.value = leads[0].key;
          var name = input(f, 'Project name', 'text');
          name.required = true;
          var brief = input(
            f,
            'Approved scope and measurable acceptance',
            'textarea',
          );
          brief.required = true;
          brief.minLength = 20;
          var evidence = input(
            f,
            'Actual founder approval or client award reference',
            'textarea',
          );
          evidence.required = true;
          evidence.minLength = 10;
          var auto = input(
            f,
            'Allow automatic acceptance of independently reviewed internal artifacts',
            'checkbox',
          );
          auto.checked = false;
          f.append(
            el(
              'p',
              'muted',
              'This charter covers internal artifacts only. Sending, spending, signing and deploying require separate approval. Client projects require a real won opportunity; internal projects do not invent a sale.',
            ),
          );
          formSave(f, 'Create approved project', function () {
            if (kind.value === 'client' && !client.value)
              throw new Error(
                'Select a real won opportunity or choose an internal project.',
              );
            var lead = leads.find(function (l) {
              return l.key === client.value;
            });
            return api('/projects', {
              key: 'project-' + crypto.randomUUID(),
              kind: kind.value,
              clientKey: kind.value === 'client' ? client.value : null,
              name: name.value,
              brief: brief.value,
              awardEvidence: evidence.value,
              product: kind.value === 'client' ? lead.product : 'AscendXI',
              autoAcceptArtifacts: auto.checked,
            });
          });
          body.append(f);
        };
        function actionPayload(body, a) {
          if (a.kind === 'email.send') {
            body.append(
              el(
                'p',
                'source',
                'From: ' +
                  a.payload.from +
                  '\nTo: ' +
                  a.payload.to.join(', ') +
                  '\nSubject: ' +
                  a.payload.subject,
              ),
              el('div', 'content', a.payload.body),
            );
            if (a.payload.threadId)
              body.append(
                el('p', 'date', 'Reply thread: ' + a.payload.threadId),
              );
          } else {
            body.append(
              el('h3', '', a.payload.summary),
              el('p', '', a.payload.description),
              el(
                'p',
                'source',
                a.payload.start +
                  ' → ' +
                  a.payload.end +
                  ' / ' +
                  a.payload.timeZone +
                  '\nAttendees: ' +
                  a.payload.attendees.join(', ') +
                  '\nCalendar: ' +
                  a.payload.calendarId,
              ),
            );
          }
        }
        function drawOutbox() {
          clear(at('outboxList'));
          (state.actions || []).forEach(function (a) {
            var n = el('article', 'panel'),
              row = el('div', 'row');
            row.append(
              el(
                'h3',
                '',
                a.kind === 'email.send' ? a.payload.subject : a.payload.summary,
              ),
              badge(
                a.status,
                ['uncertain', 'sending', 'blocked'].includes(a.status)
                  ? 'warning'
                  : 'neutral',
              ),
            );
            n.append(row);
            actionPayload(n, a);
            if (a.error) n.append(el('p', 'notice', a.error));
            if (a.receipt)
              n.append(
                el(
                  'p',
                  'source',
                  'Provider receipt: ' + JSON.stringify(a.receipt),
                ),
              );
            var actions = el('div', 'actions');
            if (a.status === 'draft')
              actions.append(
                button(
                  'Review exact action',
                  function () {
                    var b = modal('Approve this exact external action?');
                    actionPayload(b, a);
                    b.append(
                      el(
                        'p',
                        'notice',
                        'This authorizes this single immutable payload. The local worker may send it after approval. Provider delivery and creation receipts will be recorded.',
                      ),
                    );
                    var f = el('form'),
                      reason = input(
                        f,
                        'Approval evidence or purpose',
                        'textarea',
                      );
                    reason.required = true;
                    reason.minLength = 10;
                    formSave(
                      f,
                      a.kind === 'email.send'
                        ? 'Approve this email'
                        : 'Approve this calendar event',
                      function () {
                        return api('/actions/' + a.id + '/approve', {
                          hash: a.hash,
                          evidence: reason.value,
                        });
                      },
                    );
                    b.append(f);
                  },
                  true,
                ),
              );
            if (['draft', 'approved', 'blocked'].includes(a.status))
              actions.append(
                button('Cancel', async function () {
                  try {
                    await api('/actions/' + a.id + '/cancel', {});
                    await refresh();
                  } catch (e) {
                    status(e.message, true);
                  }
                }),
              );
            if (['uncertain', 'sending'].includes(a.status))
              actions.append(
                button('Record provider reconciliation', function () {
                  var body = modal('Reconcile uncertain delivery'),
                    f = el('form');
                  body.append(
                    el(
                      'p',
                      'notice',
                      'Inspect the real provider first. This records operator evidence and never resends. An active send cannot be reconciled until its five-minute safety window has passed.',
                    ),
                  );
                  var outcome = input(f, 'Observed provider outcome', 'select');
                  fillSelect(
                    outcome,
                    [
                      ['sent', 'Provider shows the action occurred'],
                      [
                        'not-sent',
                        'Provider confirms the action did not occur',
                      ],
                    ],
                    null,
                  );
                  outcome.value = 'sent';
                  var evidence = input(
                    f,
                    'Actual provider evidence and reference',
                    'textarea',
                  );
                  evidence.required = true;
                  evidence.minLength = 20;
                  formSave(f, 'Record reconciliation · no resend', function () {
                    return api('/actions/' + a.id + '/reconcile', {
                      outcome: outcome.value,
                      evidence: evidence.value,
                    });
                  });
                  body.append(f);
                }),
              );
            n.append(actions);
            at('outboxList').append(n);
          });
          if (!(state.actions || []).length)
            at('outboxList').append(
              el(
                'p',
                'empty',
                'No communication actions. Drafts remain visible here before any external action.',
              ),
            );
        }
        function composeAction(kind) {
          var b = modal(
              kind === 'email.send'
                ? 'Draft a client email'
                : 'Prepare a calendar event',
            ),
            f = el('form');
          if (!(state.projects || []).length) {
            b.append(
              el(
                'p',
                'notice',
                'Record an awarded project before preparing project communication.',
              ),
            );
            return;
          }
          var project = input(f, 'Project', 'select');
          fillSelect(
            project,
            state.projects.map(function (p) {
              return [p.id, p.name];
            }),
            null,
          );
          project.value = state.projects[0].id;
          var fields = {};
          if (kind === 'email.send') {
            fields.from = input(f, 'Verified sending address', 'email');
            fields.to = input(
              f,
              'Recipient business addresses · comma separated',
              'text',
            );
            fields.subject = input(f, 'Email subject', 'text');
            fields.body = input(f, 'Exact email body', 'textarea');
            fields.body.rows = 9;
            fields.threadId = input(
              f,
              'Existing Gmail thread ID · optional',
              'text',
            );
            fields.inReplyTo = input(
              f,
              'Original Message-ID header · optional for a reply',
              'text',
            );
            ['from', 'to', 'subject', 'body'].forEach(function (k) {
              fields[k].required = true;
            });
          } else {
            fields.calendarId = input(f, 'Calendar ID', 'text', 'primary');
            fields.summary = input(f, 'Event title', 'text');
            fields.description = input(
              f,
              'Exact event description',
              'textarea',
            );
            fields.start = input(
              f,
              'Start · RFC3339 with timezone offset',
              'text',
            );
            fields.end = input(f, 'End · RFC3339 with timezone offset', 'text');
            fields.timeZone = input(
              f,
              'IANA timezone',
              'text',
              Intl.DateTimeFormat().resolvedOptions().timeZone,
            );
            fields.attendees = input(
              f,
              'Attendee business emails · comma separated',
              'text',
            );
            [
              'calendarId',
              'summary',
              'start',
              'end',
              'timeZone',
              'attendees',
            ].forEach(function (k) {
              fields[k].required = true;
            });
          }
          f.append(
            el(
              'p',
              'muted',
              'Saving creates a draft. Approval is a separate review of the exact content.',
            ),
          );
          formSave(f, 'Save communication draft', function () {
            var payload = {};
            Object.keys(fields).forEach(function (k) {
              if (fields[k].value !== '') payload[k] = fields[k].value;
            });
            if (kind === 'email.send')
              payload.to = payload.to
                .split(',')
                .map(function (x) {
                  return x.trim();
                })
                .filter(Boolean);
            else {
              payload.attendees = payload.attendees
                .split(',')
                .map(function (x) {
                  return x.trim();
                })
                .filter(Boolean);
              if (!payload.description) payload.description = '';
            }
            return api('/actions', {
              key: 'action-' + crypto.randomUUID(),
              projectId: project.value,
              kind: kind,
              payload: payload,
            });
          });
          b.append(f);
        }
        at('newEmail').onclick = function () {
          composeAction('email.send');
        };
        at('newMeeting').onclick = function () {
          composeAction('calendar.create');
        };
        setInterval(function () {
          if (
            !document.hidden &&
            !at('modal').open &&
            !at('projectMessage').value &&
            !at('chatMessage').value &&
            !chatRunning
          )
            refresh();
        }, 8000);
        refresh();
      })();
    </script>
  </body>
</html>
`;

export const dashboardHtml=legacyHtml
  .replace(/<nav aria-label="Company sections">[\s\S]*?<\/nav>/, '<nav aria-label="Company sections">'+compactNavigation+'</nav>')
  .replace('</style>',liveStyles+compactStyles+operatingStyles+connectorStyles+'</style>')
  .replace('<section class="view" id="overview">',liveMarkup+planningMarkup+'<section class="view" id="overview" hidden>')
  .replace('<div id="status"', '<div id="sectionTabs"></div><div id="status"')
  .replace('<div id="notificationList"','<div id="decisionPlans" class="decision-strip"></div><span id="learningCount" hidden></span><div id="notificationList"')
  .replace('drawWorker();','drawWorker(); startOperationsLive();')
  .replace('<div id="messageList"','<pre id="chatLive" class="live-preview" aria-live="polite"></pre><div id="messageList"')
  .replace('      })();',liveScript+'\n'+planningScript+'\n'+operatingScript+'\n'+connectorScript+'\n      })();')
  .replace(/setInterval\([\s\S]*?, 8000\);/, '')
  .replace('Save company goal','Save goal proposal')
  .replace('Set a company goal','Propose a company goal')
  .replace('Record approved project','Propose a project');
