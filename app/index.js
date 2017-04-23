var _ = require('lodash');
var express = require('express');
var bodyParser = require("body-parser");
var fs = require('fs');
var pdf = require('html-pdf');
var uuid = require('uuid/v4');

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var config = {
  format: 'letter',
  base: 'file:///' + __dirname.replace(/\\/g, '/') + '/'
};

var constants = {
  invoiceTemplate: './app/tpl/invoice.tpl.html',
  complaintTemplate: './app/tpl/complaint.tpl.html',
  partTemplate: './app/tpl/part.tpl.html',
  paymentTemplate: './app/tpl/payment.tpl.html',
  serviceCallTemplate: './app/tpl/service-call.tpl.html',
  serviceNotesTemplate: './app/tpl/service-note.tpl.html',

  invoiceNumber: '%%invoiceNumber%%',
  ticketDateOpen: '%%ticketDateOpen%%',

  customerName: '%%customerName%%',
  customerAddress: '%%customerAddress%%',
  customerCityStateZip: '%%customerCityStateZip%%',
  customerPhone1: '%%customerPhone1%%',
  customerPhone2: '%%customerPhone2%%',

  billingName: '%%billingName%%',
  billingAddress: '%%billingAddress%%',
  billingCityStateZip: '%%billingCityStateZip%%',
  billingPhone1: '%%billingPhone1%%',
  billingPhone2: '%%billingPhone2%%',

  productItem: '%%productItem%%',
  productBrand: '%%productBrand%%',
  productModel: '%%productModel%%',
  productSerial: '%%productSerial%%',
  productDate: '%%productDate%%',

  ticketComplaint: '%%ticketComplaint%%',
  ticketComplaintLine: '%%ticketComplaintLine%%',

  ticketPartList: '%%ticketPartList%%',
  ticketPartListPartBrand: '%%ticketPartListPartBrand%%',
  ticketPartListPartDescription: '%%ticketPartListPartDescription%%',
  ticketPartListPartNumber: '%%ticketPartListPartNumber%%',
  ticketPartListPartPrice: '%%ticketPartListPartPrice%%',
  ticketPartListPartQuantity: '%%ticketPartListPartQuantity%%',
  ticketPartListPartTotal: '%%ticketPartListPartTotal%%',

  ticketServiceNotes: '%%ticketServiceNotes%%',
  ticketServiceNotesLine: '%%ticketServiceNotesLine%%',

  ticketServiceCallList: '%%ticketServiceCallList%%',
  ticketServiceCallListDateTime: '%%ticketServiceCallListDateTime%%',
  ticketServiceCallListTech: '%%ticketServiceCallListTech%%',

  ticketPaymentList: '%%ticketPaymentList%%',
  ticketPaymentListPaymentDate: '%%ticketPaymentListPaymentDate%%',
  ticketPaymentListPaymentType: '%%ticketPaymentListPaymentType%%',
  ticketPaymentListPaymentAmount: '%%ticketPaymentListPaymentAmount%%',

  ticketSubtotal: '%%ticketSubtotal%%',
  ticketTax: '%%ticketTax%%',
  ticketTotal: '%%ticketTotal%%',
  ticketAmountPaid: '%%ticketAmountPaid%%',
  ticketBalanceDue: '%%ticketBalanceDue%%',
};

function replaceAll(str, find, replace) {
  return str.replace(new RegExp(find, 'g'), replace);
}

function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) { return ''; }

  var value = phoneNumber.toString().trim().replace(/[^0-9]/, '');

  switch (value.length) {
  case 0:
  case 1:
  case 2:
  case 3:
    return value;

  case 4:
  case 5:
  case 6:
  case 7:
    return value.slice(0, 3) + '-' + value.slice(3);

  default:
    var base = value.slice(3);
    return '(' + value.slice(0, 3) + ') ' + base.slice(0, 3) + '-' + base.slice(3, 7);
  }
}

function formatCurrency(amount) {
  var sign = amount < 0 ? "-" : "";

  var wholePart = parseInt(Math.abs(amount)).toString();
  var highestPartLength = wholePart.length > 3 ? wholePart.length % 3 : 0;

  var retVal = sign + '$' + (highestPartLength ? wholePart.substr(0, highestPartLength) + ',' : "");
  retVal += wholePart.substr(highestPartLength).replace(/(\d{3})(?=\d)/g, "$1" + ',');
  retVal += '.' + (Math.abs(amount) - wholePart).toFixed(2).slice(2);

  return retVal;
}

app.get('/invoice/:id', function (req, res) {
  if (!req.params.id) {
    res.status(400).send('You must include the invoice id!');
    return;
  }

  var filePath = './app/tmp/' + req.params.id + '.pdf';
  if (!fs.existsSync(filePath)) {
    res.status(404).send('Invoice not found!');
    return;
  }

  res.contentType("application/pdf");
  res.send(fs.readFileSync(filePath));
});

app.post('/invoice', function (req, res) {

  if (!req.body.customer || !req.body.ticket) {
    res.status(400).send('You must include customer and ticket details!');
    return;
  }

  // read in template file
  var invoice =  fs.readFileSync(constants.invoiceTemplate, 'utf8');

  // header fields
  invoice = replaceAll(invoice, constants.invoiceNumber, _.get(req.body.ticket, 'id', ''));
  invoice = replaceAll(invoice, constants.ticketDateOpen, _.get(req.body.ticket, 'dateOpen', ''));

  // customer info
  invoice = replaceAll(invoice, constants.customerName,
                       _.get(req.body.customer, 'firstName', '') + ' ' + _.get(req.body.customer, 'lastName', ''));
  invoice = replaceAll(invoice, constants.customerAddress, _.get(req.body.customer, 'address', ''));

  var customerCity = _.get(req.body.customer, 'city', '');
  var customerState = _.get(req.body.customer, 'state', '');
  var customerZip = _.get(req.body.customer, 'zip', '');

  var customerCityStateZip = (customerCity ? customerCity + ',' : '') + ' ' + customerState + ' ' + customerZip;

  invoice = replaceAll(invoice, constants.customerCityStateZip, customerCityStateZip);

  invoice = replaceAll(invoice, constants.customerPhone1, formatPhoneNumber(_.get(req.body.customer, 'phoneNumber', '')));
  invoice = replaceAll(invoice, constants.customerPhone2, formatPhoneNumber(_.get(req.body.customer, 'workNumber', '')));

  // billing info
  invoice = replaceAll(invoice, constants.billingName,
                       _.get(req.body.ticket, 'firstName', '') + ' ' + _.get(req.body.ticket, 'lastName', ''));
  invoice = replaceAll(invoice, constants.billingAddress, _.get(req.body.ticket, 'address', ''));

  var billingCity = _.get(req.body.ticket, 'city', '');
  var billingState = _.get(req.body.ticket, 'state', '');
  var billingZip = _.get(req.body.ticket, 'zip', '');

  var billingCityStateZip = (billingCity ? billingCity + ',' : '') + ' ' + billingState + ' ' + billingZip;

  invoice = replaceAll(invoice, constants.billingCityStateZip, billingCityStateZip || customerCityStateZip);

  invoice = replaceAll(invoice, constants.billingPhone1, formatPhoneNumber(_.get(req.body.ticket, 'phoneNumber', '')));
  invoice = replaceAll(invoice, constants.billingPhone2, formatPhoneNumber(_.get(req.body.ticket, 'workNumber', '')));

  // product info
  invoice = replaceAll(invoice, constants.productItem, _.get(req.body.ticket, 'item', ''));
  invoice = replaceAll(invoice, constants.productBrand, _.get(req.body.ticket, 'brand', ''));
  invoice = replaceAll(invoice, constants.productModel, _.get(req.body.ticket, 'model', ''));
  invoice = replaceAll(invoice, constants.productSerial, _.get(req.body.ticket, 'serialNumber', ''));
  invoice = replaceAll(invoice, constants.productDate, _.get(req.body.ticket, 'dateOfPurchase', ''));

  // customer complaints
  var complaintTpl =  fs.readFileSync(constants.complaintTemplate, 'utf8');
  var complaintReplace = '';
  _.each(_.get(req.body.ticket, 'customerComplaint', '').split('\r\n'), function(line) {
    complaintReplace += replaceAll(complaintTpl, constants.ticketComplaintLine, line);
  });

  invoice = replaceAll(invoice, constants.ticketComplaint, complaintReplace);

  //parts list
  var partTpl =  fs.readFileSync(constants.partTemplate, 'utf8');
  var partListReplace = '';
  _.each(_.get(req.body.ticket, 'parts', []), function(part) {
    var partCopy = partTpl;
    partCopy = replaceAll(partCopy, constants.ticketPartListPartBrand, _.get(part, 'brand', ''));
    partCopy = replaceAll(partCopy, constants.ticketPartListPartDescription, _.get(part, 'description', ''));
    partCopy = replaceAll(partCopy, constants.ticketPartListPartNumber, _.get(part, 'partNum', ''));
    partCopy = replaceAll(partCopy, constants.ticketPartListPartPrice, formatCurrency(_.get(part, 'price', 0)));
    partCopy = replaceAll(partCopy, constants.ticketPartListPartQuantity, _.get(part, 'quantity', 0));
    partCopy = replaceAll(partCopy, constants.ticketPartListPartTotal, formatCurrency(_.get(part, 'total', 0)));

    partListReplace += partCopy;
  });

  invoice = replaceAll(invoice, constants.ticketPartList, partListReplace);

  // service notes
  var serviceNotesTpl =  fs.readFileSync(constants.serviceNotesTemplate, 'utf8');
  var serviceNotesReplace = '';
  _.each(_.get(req.body.ticket, 'serviceDescription', '').split('\r\n'), function(line) {
    serviceNotesReplace += replaceAll(serviceNotesTpl, constants.ticketServiceNotesLine, line);
  });

  invoice = replaceAll(invoice, constants.ticketServiceNotes, serviceNotesReplace);

  // service call list
  var serviceCallTpl =  fs.readFileSync(constants.serviceCallTemplate, 'utf8');
  var serviceCallListReplace = '';
  _.each(_.get(req.body.ticket, 'serviceCalls', []), function(sc) {
    var serviceCallCopy = serviceCallTpl;
    serviceCallCopy = replaceAll(serviceCallCopy, constants.ticketServiceCallListDateTime, _.get(sc, 'serviceDate', ''));
    serviceCallCopy = replaceAll(serviceCallCopy, constants.ticketServiceCallListTech, _.get(sc, 'tech', ''));

    serviceCallListReplace += serviceCallCopy;
  });

  invoice = replaceAll(invoice, constants.ticketServiceCallList, serviceCallListReplace);

  // payment list
  var paymentTpl =  fs.readFileSync(constants.paymentTemplate, 'utf8');
  var paymentListReplace = '';
  _.each(_.get(req.body.ticket, 'payments', []), function(payment) {
    var paymentCopy = paymentTpl;
    paymentCopy = replaceAll(paymentCopy, constants.ticketPaymentListPaymentDate, _.get(payment, 'paymentDate', ''));
    paymentCopy = replaceAll(paymentCopy, constants.ticketPaymentListPaymentType, _.get(payment, 'paymentType', ''));
    paymentCopy = replaceAll(paymentCopy, constants.ticketPaymentListPaymentAmount, formatCurrency(_.get(payment, 'paymentAmount', 0) * -1));

    paymentListReplace += paymentCopy;
  });

  invoice = replaceAll(invoice, constants.ticketPaymentList, paymentListReplace);

  // totals
  invoice = replaceAll(invoice, constants.ticketSubtotal, formatCurrency(_.get(req.body.ticket, 'subtotal', 0)));
  invoice = replaceAll(invoice, constants.ticketTax, formatCurrency(_.get(req.body.ticket, 'tax', 0)));
  invoice = replaceAll(invoice, constants.ticketTotal, formatCurrency(_.get(req.body.ticket, 'total', 0)));
  invoice = replaceAll(invoice, constants.ticketAmountPaid, formatCurrency(_.get(req.body.ticket, 'amountPaid', 0) * -1));
  invoice = replaceAll(invoice, constants.ticketBalanceDue, formatCurrency(_.get(req.body.ticket, 'balanceDue', 0)));

  var id = uuid();
  pdf.create(invoice, config).toFile('./app/tmp/' + id + '.pdf', function (err) {
    if (err) {
      res.status(500).send(err);
      return;
    }

    res.json({ invoiceId: id });
  });
});

app.listen(9085, function () {
  console.log('Listening for invoice requests!');
});
