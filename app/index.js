var express = require('express');
var fs = require('fs');
var pdf = require('html-pdf');

var app = express();

// respond with "hello world" when a GET request is made to the homepage
app.get('/', function (req, res) {
    var html =  fs.readFileSync('./app/tpl/invoice.tpl.html', 'utf8');
    var config = {format: 'letter'};

    pdf.create(html, config).toStream(function (err, stream) {
        if (err) {
            return console.log(err);
        }

        res.setHeader('content-type', 'application/pdf');
        stream.pipe(res);
    });
});

app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});

// // Get the raw HTML response body
// var html = response.body;
// var config = {format: 'letter'}; // or format: 'letter' - see https://github.com/marcbachmann/node-html-pdf#options

// // Create the PDF
// pdf.create(html, config).toFile('pathtooutput/generated.pdf', function (err, res) {
//     if (err) return console.log(err);
//     console.log(res); // { filename: '/pathtooutput/generated.pdf' }
// });
