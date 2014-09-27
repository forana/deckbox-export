var config = require("./config.json"),
    request = require("request"),
    q = require("q"),
    htmlparser = require("htmlparser"),
    select = require("soupselect").select,
    fs = require("fs");

var selectSingle = function(html, selector, callback) {
    var d = q.defer();

    var handler = new htmlparser.DefaultHandler(function (err, dom) {
        if (err) {
            d.reject(err);
        } else {
            var results = select(dom, selector);
            d.resolve(results);
        }
    });

    var parser = new htmlparser.Parser(handler);
    parser.parseComplete(html);

    return d.promise;
};

var authenticityToken;

q.nfcall(request.get, {
    url: "https://deckbox.org/accounts/login",
    jar: true
})
.spread(function (response, body) {
    return selectSingle(body, "input[name=authenticity_token]");
})
.then(function (results) {
    authenticityToken = results[0].attribs.value;
    console.log("authenticity_token = " + authenticityToken);
    return q.nfcall(request.post, {
        url: "https://deckbox.org/accounts/login",
        form: {
            username: config.username,
            password: config.password,
            authenticity_token: authenticityToken
        },
        jar: true
    });
})
.spread(function (response, body) {
    console.log("signed in, exporting set " + config.setID);
    return q.nfcall(request.get, {
        url: "https://deckbox.org/sets/export/" + config.setID + "?format=csv&s=&o=&columns=&v2=true",
        jar: true
    });
})
.spread(function (response, body) {
    var disposition = response.headers["content-disposition"];
    var filename = disposition.split('"')[1];
    console.log("writing " + filename + " (" + body.length + " bytes)");
    return q.nfcall(fs.writeFile, config.exportsPath + "/" + filename, body);
})
.then(function () {
    console.log("done");
})
.catch(console.error);
