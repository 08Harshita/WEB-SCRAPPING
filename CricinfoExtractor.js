//node CricinfoExtractor.js --excel=Worldcup.csv --data=DataFolder --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results 

let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let excel = require("excel4node");
let pdf = require("pdf-lib");
let fs = require("fs");
let path = require("path");

let args = minimist(process.argv);

let downloadkapromise = axios.get(args.source);
downloadkapromise.then(function (response) {
    let html = response.data;

    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;

    let matches = [];
    let matchScoreDivs = document.querySelectorAll("div.match-score-block");
    for (let i = 0; i < matchScoreDivs.length; i++) {
        let match = {
            t1: "",
            t2: "",
            t1s: "",
            t2s: "",
            result: ""
        };

        let namePs = matchScoreDivs[i].querySelectorAll("p.name");
        match.t1 = namePs[0].textContent;
        match.t2 = namePs[1].textContent;

        let matchScore = matchScoreDivs[i].querySelectorAll("span.score");
        if (matchScore.length == 2) {
            match.ts1 = matchScore[0].textContent;
            match.ts2 = matchScore[1].textContent;
        } else if (matchScore.length == 1) {
            match.ts1 = matchScore[0].textContent;
            match.ts2 = "";
        } else if (matchScore.length == 0) {
            match.ts1 = "";
            match.ts2 = "";
        }

        let resultSpan = matchScoreDivs[i].querySelector("div.status-text>span");
        match.result = resultSpan.textContent;

        matches.push(match);
    }

    let matchesJSON = JSON.stringify(matches);   
    fs.writeFileSync("matches.json", matchesJSON, "utf-8");
    let teams = [];
    for (let i = 0; i < matches.length; i++) {
        putTeamInTeamsArrayIfMissing(teams, matches[i]);
    }
    for (let i = 0; i < matches.length; i++) { 
        putMatchInAppropriateTeam(teams, matches[i]);
    }
    let teamsJSON = JSON.stringify(teams);  
    fs.writeFileSync("teams.json", teamsJSON, "utf-8");

    createExcelFile(teams, args.excel);
    prepareFoldersandPdfs(teams, args.data);
})
function prepareFoldersandPdfs(teams, data) {
    if (fs.existsSync(data) == false) {
        fs.mkdirSync(data);
    }
    for (let i = 0; i < teams.length; i++) {
        let teamFolderName = path.join(data, teams[i].name);
        if (fs.existsSync(teamFolderName) == false) {
            fs.mkdirSync(teamFolderName);
        }
        for (let j = 0; j < teams[i].matches.length; j++) {
            let match = teams[i].matches[j];
            createMatchScorecardPdf(teamFolderName, teams[i].name, match);
        }
    }
}

function createMatchScorecardPdf(teamFolderName, homeTeam, match) {
    let matchFileName = path.join(teamFolderName, match.vs + ".pdf");
    let templateFileBytes = fs.readFileSync("Template.pdf");
    let pdfdocKaPromise = pdf.PDFDocument.load(templateFileBytes);
    pdfdocKaPromise.then(function (pdfdoc) {
        let page = pdfdoc.getPage(0);

        page.drawText(homeTeam, {
            x: 315,
            y: 335,
            size: 22
        });
        page.drawText(match.vs, {
            x: 315,
            y: 275,
            size: 22
        });
        page.drawText(match.selfScore, {
            x: 315,
            y: 220,
            size: 22
        });
        page.drawText(match.oppScore, {
            x: 315,
            y: 160,
            size: 22
        });
        page.drawText(match.result, {
            x: 315,
            y: 100,
            size: 22
        });
        let changedbyteskapromise = pdfdoc.save();
        changedbyteskapromise.then(function (changedBytes) {
            fs.writeFileSync(matchFileName, changedBytes);
        })
    })
}

function createExcelFile(teams, excelFileName) {
    let wb = new excel.Workbook();
    for (let i = 0; i < teams.length; i++) {
        let sheet = wb.addWorksheet(teams[i].name);
        sheet.cell(1, 1).string("VS");
        sheet.cell(1, 2).string("Self Score");
        sheet.cell(1, 3).string("Oppo Score");
        sheet.cell(1, 4).string("Result");
        for (j = 0; j < teams[i].matches.length; j++) {
            sheet.cell(j + 2, 1).string(teams[i].matches[j].vs);
            sheet.cell(j + 2, 2).string(teams[i].matches[j].selfScore);
            sheet.cell(j + 2, 3).string(teams[i].matches[j].oppScore);
            sheet.cell(j + 2, 4).string(teams[i].matches[j].result);
        }

    }
    wb.write(excelFileName);
}

function putTeamInTeamsArrayIfMissing(teams, match) {
    let t1idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t1) {
            t1idx = i;
            break;
        }
    }
    if (t1idx == -1) {
        teams.push({
            name: match.t1,
            matches: []
        });
    }
    let t2idx = -1;//same for t2 
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t2) {
            t2idx = i;
            break;
        }
    }
    if (t2idx == -1) {
        teams.push({
            name: match.t2,
            matches: []
        });
    }
}
function putMatchInAppropriateTeam(teams, match) {
    let t1idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t1) {
            t1idx = i;
            break;
        }
    }

    let team1 = teams[t1idx];
    team1.matches.push({
        vs: match.t2,
        selfScore: match.ts1,
        oppScore: match.ts2,
        result: match.result
    });

    let t2idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t2) {
            t2idx = i;
            break;
        }
    }

    let team2 = teams[t2idx];
    team2.matches.push({
        vs: match.t1,
        selfScore: match.ts2,
        oppScore: match.ts1,
        result: match.result
    });
}



