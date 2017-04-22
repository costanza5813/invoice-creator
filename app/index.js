var express = require('express');
var fs = require('fs');
var pdf = require('html-pdf');

var app = express();

var config = {
  format: 'letter',
  base: 'file:///' + __dirname.replace(/\\/g, '/') + '/'
};

//kdj TODO make this a post
app.get('/', function (req, res) {
  var invoice =  fs.readFileSync('./app/tpl/invoice.tpl.html', 'utf8');

  //kdj TODO remove this
  console.log(config.base);

  pdf.create(invoice, config).toStream(function (err, stream) {
    if (err) {
      return console.log(err);
    }

    res.setHeader('content-type', 'application/pdf');
    stream.pipe(res);
  });
});

app.listen(9085, function () {
  console.log('Listening for invoice requests!');
});
