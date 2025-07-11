let allToType = document.getElementById("toType").value; // The remainder of the text to type
let nextIndex = 1; // The next index the user will type
let firstTime; // Start of timer in milliseconds since 1 January 1970
let currTime; // Current time in milliseconds since 1 January 1970
let currCpm = 0; // Current characters per minute, updated every 100 milliseconds
let currWpm = 0; // Current *words* per minute, equals currCpm divided by 5
let lastTime; // End of test/when test is completed, same format as firstTime/currTime
let disabled = false; // Disable inputting if true (Enter to reset is still allowed)
let startLength = 0; // Initial length of allToType before we remove any characters
let personalBest = -1; // PB words per minute
let pbv = localStorage.getItem("pbs");
let pbs;
pbs = pbv ? JSON.parse(pbv) : [];
let prevWpmsVal = localStorage.getItem("prevWpms");
let prevWpms = [];
prevWpms = prevWpmsVal ? JSON.parse(prevWpmsVal) : [];
let testInProgress = false; // Is a test running?
let focusToggleInterval;
let focusToggleFrac = 1;
let focusing = false;
let currentTestType = {
    type: "words",
    words: 10,
    timer: 0
};
const datasetsToLoad = [
    {
        path: "js/datasets/english100.js",
        local: true
    },
    {
        path: "js/datasets/english1k.js",
        local: true
    },
    {
        path: "js/datasets/latin1k.js",
        local: true
    }
];
const firstBreak = function (aStr, bStr) {
    if (bStr.length > aStr.length)
        return aStr.length;
    let a = Array.from(aStr);
    let b = Array.from(bStr);
    let matchingChars = a.map((e, i) => e != b[i]);
    let totalUntilBreak = 0;
    for (let i = 0; i < matchingChars.length; i++) {
        if (matchingChars[i])
            return totalUntilBreak;
        totalUntilBreak++;
    }
    return -1;
};
const addPB = (cpm, wpm, tt) => {
    let pb = {
        testType: tt,
        cpm: cpm,
        wpm: wpm
    };
    let pbVal = localStorage.getItem("pbs"); // get pb JSON as a string
    if (!pbVal) { // if it's invalid/falsy
        pbs = [pb]; // then make pbs into a list with just this pb,
        localStorage.setItem("pbs", JSON.stringify(pbs)); // save the pb,
        return; // and exit early
    }
    let ourPbId = `${tt.type}-${tt.words}-${tt.timer}`; // convert into a compatible format for comparing to other pb
    let uniquePbIds = pbs.map(pbV => pbV.testType).map(ttV => `${ttV.type}-${ttV.words}-${ttV.timer}`); // convert all the other pbs into the same format
    if (!uniquePbIds.includes(ourPbId)) { // if we don't have the type of test already,
        pbs.push(pb); // add it to the pb list, 
        localStorage.setItem("pbs", JSON.stringify(pbs)); // save the pbs,
        return; // and exit early
    }
    let contrastingPbIndex = uniquePbIds.indexOf(ourPbId); // if it already has this pb somewhere (perhaps multiple times),
    while (contrastingPbIndex != -1) { // repeat until all the pbs of the same type are gone
        let contrastingPb = pbs[contrastingPbIndex]; // find the pb from the key
        if (contrastingPb.cpm >= cpm) { // if our pb is worse, 
            localStorage.setItem("pbs", JSON.stringify(pbs)); // save the pbs,
            uniquePbIds[contrastingPbIndex] = ""; // overwrite this pb,
            contrastingPbIndex = uniquePbIds.indexOf(ourPbId); // reassign the index (see top of while loop for why it's used)
            continue; // and continue onto next iteration if necessary
        }
        pbs.splice(contrastingPbIndex, 1); // if our pb is better, remove the worse pb that needs to be replaced
        uniquePbIds.splice(contrastingPbIndex, 1); // remove the corresponding entrance from the list of unique pb ids,
        contrastingPbIndex = uniquePbIds.indexOf(ourPbId); // reassign the index (again, see top of while loop)
    }
    pbs.push(pb); // then, we can push our pb,
    localStorage.setItem("pbs", JSON.stringify(pbs)); // and save
};
const clampIfUndefined = (v, clampTo) => (v == undefined || v == null || v == -1) ? clampTo : v; // clamp to clampTo if the value is unusable/invalid
const findPB = (tt) => clampIfUndefined(pbs[pbs.map(pbV => pbV.testType).map(ttV => `${ttV.type}-${ttV.words}-${ttV.timer}`).indexOf(`${tt.type}-${tt.words}-${tt.timer}`)], { testType: currentTestType, cpm: -1, wpm: -1 }); // find a pb of TestType tt and get it as PersonalBest
function reloadDatasets() {
    datasetsToLoad.forEach(importDataset);
    disabled = true;
}
function updateStats() {
    generateGraph(document.getElementById("statsGraph"), prevWpms);
}
function generateDatasetDropdown() {
    let names = datasetList.map(e => e.name);
    let ids = datasetList.map(e => e.id);
    document.getElementById("datasetField").innerHTML = ""; // clear old datasets
    names.forEach((e, i) => {
        /** Should end up looking like this (in datasetField div):
         * <div class="display-text smaller-text">
         * 		<input type="radio" value=1 name="datasetPicker" id="optionenglish1k" />
         * 		<label class="big-label" for="optionenglish1k">english 1k</label>
         * </div>
         */
        let eleDiv = document.createElement("div");
        let eleInput = document.createElement("input");
        let eleLabel = document.createElement("label");
        eleInput.setAttribute("value", i.toString());
        eleInput.setAttribute("type", "radio");
        eleInput.setAttribute("name", "datasetPicker");
        eleInput.id = "option" + ids[i];
        eleLabel.setAttribute("for", "option" + ids[i]);
        eleLabel.innerHTML = e;
        eleLabel.classList.add("big-label");
        eleDiv.classList.add("display-text");
        eleDiv.classList.add("smaller-text");
        eleInput.classList.add("radio-picker");
        eleDiv.appendChild(eleInput);
        eleDiv.appendChild(eleLabel);
        if (i === 0)
            eleInput.checked = true;
        document.getElementById("datasetField").appendChild(eleDiv);
    });
}
function generatePrompt(len = 10, datasetIndex) {
    allToType = datasetList[datasetIndex].generatorFunction(len);
    startLength = allToType.length;
    document.getElementById("toType").value = allToType;
}
function getTestType() {
    const params = (document.querySelector(`input[name="typePicker"]:checked`).value).split("-"); // from "words-10-0" to ["words", "10", "0"]
    return {
        type: params[0], // using above example: "words" (format title)
        words: parseInt(params[1]), // using above example: 10 (words)
        timer: parseInt(params[2]) // using above example: 0 (seconds/no time limit)
    };
}
const updatePB = () => {
    personalBest = findPB(currentTestType).wpm;
    document.getElementById("pbWordsPerMin").innerHTML = isNaN(personalBest) || personalBest === -1 ? "0.000" : personalBest.toFixed(3); // display 
};
const easeInOut = (x) => Math.pow(x, 2) * (3 - 2 * x);
function finishTest() {
    if (focusOnType)
        toggleFocusMode(true);
    document.getElementById("typed").style.backgroundColor = "#4c9638"; // 3gIV. If we've finished, continue and set the background color to green to indicate the player is done
    lastTime = new Date().getTime(); // 3gV. Get the final time (see firstTime/currTime for what the value means)
    disabled = true; // 3gVI. Disable more inputting
    window.setTimeout(() => {
        addPB(currCpm, currWpm, currentTestType);
        prevWpms.push(currWpm);
        localStorage.setItem("prevWpms", JSON.stringify(prevWpms));
        updateStats();
        updatePB();
    }, 125);
}
function toggleFocusMode(enable = false, delay = 5) {
    let toExec = (conditionFunction, step) => {
        if (conditionFunction(focusToggleFrac))
            return window.clearInterval(focusToggleInterval);
        focusToggleFrac += step;
    };
    focusToggleInterval = window.setInterval(() => {
        Array.from(document.querySelectorAll(".focus-hide")).forEach((e) => {
            e.style.opacity = `${100 * easeInOut(focusToggleFrac)}%`;
            toExec(enable ?
                (pc) => pc >= 1 :
                (pc) => pc <= 0, enable ?
                0.01 :
                -0.01);
        });
    }, delay);
}
window.onload = function () {
    personalBest = -1;
    updatePB();
    reloadDatasets();
    let canvas = document.getElementById("statsGraph");
    canvas.width = 1000;
    canvas.height = 200;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    updateStats();
    document.getElementById("typed").addEventListener("paste", e => e.preventDefault()); // 2. Disable cheating via pasting text
    Array.from(document.querySelectorAll(".type-picker-radio")).forEach((e) => e.addEventListener("click", e => {
        currentTestType = getTestType();
        updatePB();
        reset();
    }));
    document.getElementById("typed").addEventListener("input", e => {
        if (disabled) { // 3a. If disabled is true, don't allow any typing!
            e.preventDefault();
            return;
        }
        if (firstTime == undefined) {
            testInProgress = true;
            if (focusOnType)
                toggleFocusMode(false);
            firstTime = new Date().getTime(); // 3b. If we haven't started the stopwatch, start it
        }
        let currentlyTyped = document.getElementById("typed").value; // 3c. Set what we've currently typed thus far (will be cleared later)
        nextIndex = currentlyTyped.length; // 3d. Assign nextIndex to the last character's index of currentlyTyped
        let shouldBeTyped = allToType.slice(0, nextIndex); // 3e. What do we need to type? For example, if we've typed "hello w" and we're to type "hello world" in total, this should be "orld"
        let firstBroken = firstBreak(currentlyTyped, shouldBeTyped); // 3f. Calculate if we've made a mistake thus far
        if (firstBroken === -1) { // 3g. If we haven't made a mistake:
            document.getElementById("typed").style.color = "black"; // 3gI. Make sure the text is the right color (usually to clear from the red if we were previously wrong) 
            if (allToType[0] == document.getElementById("typed").value[0]) { // 3gII. If the newly-typed character is correct, remove it from the start of all toType.value, allToType, and typed.value
                allToType = allToType.substring(1);
                document.getElementById("toType").value = allToType;
                document.getElementById("typed").value = document.getElementById("typed").value.substring(1);
            }
            if (shouldBeTyped.length < document.getElementById("toType").value.length || allToType.length > 0)
                return; // 3gIII. If we're not done with the test yet, return and exit early.
            finishTest(); // End the test
            return; // 3gVIII. Don't continue to the next part! 
        }
        console.log(`wrong @ ${firstBroken} (and maybe onwards)`); // 3h. If the player misinputted, log a little info in the console telling where we're wrong for debugging
        document.getElementById("typed").style.color = "red"; // 3i. If the  misinputted, set the color of their inputted text to red to tell them they're wrong somewhereDropdown.
    });
    window.setInterval(() => {
        currTime = lastTime === undefined ? new Date().getTime() : lastTime;
        let secs = (currTime - firstTime) / 1000;
        let mins = secs / 60;
        currCpm = mins !== 0 ? (startLength - allToType.length) / mins : 0;
        currWpm = currCpm / 5;
        if (currentTestType.timer > 0 && secs > currentTestType.timer && !disabled)
            finishTest();
        if (testInProgress)
            updateDisplays(); // 4a. Also update the displays
    }, 100);
    document.getElementById("typed").addEventListener("keypress", e => {
        if (e.key == "Enter") {
            reset();
            updateDisplays();
        } // 5a. If Enter has been pressed, reset to the start
        if (disabled) {
            e.preventDefault();
            return;
        } // 5b. Otherwise, make sure we're not typing if disabled is true.
    });
    loadListeners();
};
function updateDisplays() {
    document.getElementById("charPerSecond").innerHTML = isNaN(currCpm) ? "0.000" : currCpm.toFixed(3); // Characters per minute (cpm), fix to 3 decimal places after the .
    document.getElementById("wordsPerMin").innerHTML = isNaN(currWpm) ? "0.000" : currWpm.toFixed(3); // Words per minute (wpm), fix to 3 decimal places after the .
    document.getElementById("timeLeft").innerHTML = isNaN(currTime - firstTime) || currentTestType.timer <= 0 ? "0.0" : Math.abs((currentTestType.timer - (currTime - firstTime) / 1000)).toFixed(1); // Time left (s), fix to 1 decimal place after the .
}
function reset() {
    if (focusOnType)
        toggleFocusMode(true, 3);
    disabled = false; // Enable typing again
    testInProgress = false; // Mark that we're done with this test
    currCpm = 0; // Reset current CPM counter
    currWpm = 0; // Reset current WPM counter
    generatePrompt(currentTestType.words, parseInt(document.querySelector(`input[name="datasetPicker"]:checked`).value)); // New prompt
    document.getElementById("typed").value = ""; // Clear out what the player has already typed
    document.getElementById("typed").style.backgroundColor = ""; // Clear the background color if they're finished (green bg color)
    firstTime = undefined; // Clear the start time
    lastTime = undefined; // Clear the end time
}
