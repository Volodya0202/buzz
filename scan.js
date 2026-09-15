
const fs = require("fs");
const path = require("path");
function walk(dir) {
    let results = [];
    let list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        let stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
            results.push(file);
        }
    });
    return results;
}
let files = walk("desktop/src");
let regex = /(label|placeholder|tooltip|description|title)=\"([A-Z][a-zA-Z0-9 ]{2,})\"/g;
let found = false;
files.forEach(f => {
    let content = fs.readFileSync(f, "utf8");
    let match;
    while ((match = regex.exec(content)) !== null) {
        let val = match[2];
        // skip common camelCase or keys
        if (!val.match(/^[a-z]+[A-Z]/) && !val.includes("http")) {
            console.log(f + ": " + match[0]);
            found = true;
        }
    }
});
if (!found) console.log("None found!");

