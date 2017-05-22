var _ = require('lodash');
var express = require('express');
var bodyParser = require("body-parser");
var fs = require('fs');
var pdf = require('html-pdf');
var uuid = require('uuid/v4');
var proxy = require('http-proxy-middleware');
var moment = require('moment');

var app = express();
app.set('port', 9085);

// Serve the static directory where the angular app is located
app.use(express.static(__dirname + '/../../appliance-point-of-sale/dist/'));

// Proxy to send the /ShoreTVCustomers requests to 9083
var shoreTvCustomersProxy = proxy({
  target: 'http://localhost:9083',
  changeOrigin: false,
  pathRewrite: {
    '^/ShoreTVCustomers/ServiceTickets/customers': '/customers',
    '^/ShoreTVCustomers/ServiceTickets/customerTickets': '/customerTickets',
    '^/ShoreTVCustomers/ServiceTickets/tickets': '/tickets',
    '^/ShoreTVCustomers/ServiceTickets/quotes': '/quotes',
    '^/ShoreTVCustomers/ServiceTickets/payments': '/payments',
    '^/ShoreTVCustomers/ServiceTickets/serviceCalls': '/serviceCalls',
    '^/ShoreTVCustomers/ServiceTickets/UI001/': '/',
    '^/ShoreTVCustomers/ServiceTickets/invoice': '/invoice'
  },
  router: {
    '/ShoreTVCustomers/Customers/customers': 'http://localhost:9084',
    '/ShoreTVCustomers/ServiceTickets/customers': 'http://localhost:9084',
    '/ShoreTVCustomers/ServiceTickets/UI001': 'http://localhost:9085',
    '/ShoreTVCustomers/ServiceTickets/invoice': 'http://localhost:9085'
  }
});

var serviceTicketsProxy = proxy({
  target: 'http://localhost:9083',
  changeOrigin: false,
});

var customersProxy = proxy({
  target: 'http://localhost:9084',
  changeOrigin: false,
});

app.use('/ShoreTVCustomers', shoreTvCustomersProxy);
app.use('/customers', customersProxy);
app.use('/tickets', serviceTicketsProxy);
app.use('/ticketsCustomer', serviceTicketsProxy);
app.use('/serviceCalls', serviceTicketsProxy);
app.use('/payments', serviceTicketsProxy);
app.use('/quotes', serviceTicketsProxy);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var config = {
  format: 'letter',
  base: 'file:///' + __dirname.replace(/\\/g, '/') + '/'
};

//
// post to invoice to create the pdf file
//
app.post('/invoice', function (req, res) {

  if (!req.body.customer || !req.body.ticket) {
    res.status(400).send('You must include customer and ticket details!');
    return;
  }

  var invoice = createInvoice(req.body);
  var id = uuid();
  pdf.create(invoice, config).toFile('./app/tmp/' + id + '.pdf', function (err) {
    if (err) {
      res.status(500).send(err);
      return;
    }

    res.json({ invoiceId: id });
  });
});

//
// get the created pdf file with the specified id
//
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

app.listen(app.get('port'), function () {
  console.log('Express server listening on port: ' + app.get('port'));
});

//
// constants for creating the html file
//
var constants = {
  paymentTypes: ['GCAF', 'COD / Other', 'Credit', 'Check', 'Cash', 'Warranty'],

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

  underlineTotals: '___underline-totals___'
};

function replaceAll(str, find, replace) {
  return str.replace(new RegExp(find, 'g'), replace);
}

function replaceFirst(str, find, replace) {
  return str.replace(new RegExp(find), replace);
}

function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    return '';
  } else if (/^[0-9-() ]*$/.test(phoneNumber)) {
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
  } else {
    return phoneNumber;
  }
}

function formatDateTimeRange(dateTime) {
  if (!dateTime) {
    return '';
  }

  var begin = moment(dateTime, 'MM/DD/YYYY h:mm a');
  var end = moment(begin).add(2, 'h');

  return begin.format('l LT') + ' - ' + end.format('LT');
}

function formatCurrency(amount) {
  var sign = parseFloat(amount.toFixed(2)) < 0 ? "-" : "";

  var wholePart = parseInt(Math.abs(amount)).toString();
  var highestPartLength = wholePart.length > 3 ? wholePart.length % 3 : 0;

  var retVal = sign + '$' + (highestPartLength ? wholePart.substr(0, highestPartLength) + ',' : "");
  retVal += wholePart.substr(highestPartLength).replace(/(\d{3})(?=\d)/g, "$1" + ',');
  retVal += '.' + (Math.abs(amount) - wholePart).toFixed(2).slice(2);

  return retVal;
}

function createInvoice(data) {

  // read in template file
  var invoice =  fs.readFileSync(constants.invoiceTemplate, 'utf8');

  // header fields
  invoice = replaceAll(invoice, constants.invoiceNumber, _.get(data.ticket, 'id', ''));
  invoice = replaceAll(invoice, constants.ticketDateOpen, _.get(data.ticket, 'dateOpen', ''));

  // customer info
  invoice = replaceAll(invoice, constants.customerName, _.get(data.customer, 'firstName', '') + ' ' + _.get(data.customer, 'lastName', ''));
  invoice = replaceAll(invoice, constants.customerAddress, _.get(data.customer, 'address', ''));

  var customerCity = _.get(data.customer, 'city', '');
  var customerState = _.get(data.customer, 'state', '');
  var customerZip = _.get(data.customer, 'zip', '');

  var customerCityStateZip = (customerCity ? customerCity + ',' : '') + ' ' + customerState + ' ' + customerZip;

  invoice = replaceAll(invoice, constants.customerCityStateZip, customerCityStateZip);

  invoice = replaceAll(invoice, constants.customerPhone1, formatPhoneNumber(_.get(data.customer, 'phoneNumber', '')));
  invoice = replaceAll(invoice, constants.customerPhone2, formatPhoneNumber(_.get(data.customer, 'workNumber', '')));

  // billing info
  var billingKeys = ['billingName', 'billingLastName', 'billingAddress', 'billingCity', 'billingState', 'billingZip', 'billingPhone1', 'billingPhone2'];
  if(_.chain(data.ticket).pick(billingKeys).some().value()) {
    invoice = replaceAll(invoice, constants.billingName, _.get(data.ticket, 'billingName', '') + ' ' + _.get(data.ticket, 'billingLastName', ''));
    invoice = replaceAll(invoice, constants.billingAddress, _.get(data.ticket, 'billingAddress', ''));

    var billingCity = _.get(data.ticket, 'billingCity', '');
    var billingState = _.get(data.ticket, 'billingState', '');
    var billingZip = _.get(data.ticket, 'billingZip', '');

    var billingCityStateZip = (billingCity ? billingCity + ',' : '') + ' ' + billingState + ' ' + billingZip;

    invoice = replaceAll(invoice, constants.billingCityStateZip, billingCityStateZip);

    invoice = replaceAll(invoice, constants.billingPhone1, formatPhoneNumber(_.get(data.ticket, 'billingPhone1', '')));
    invoice = replaceAll(invoice, constants.billingPhone2, formatPhoneNumber(_.get(data.ticket, 'billingPhone2', '')));
  } else {
    invoice = replaceAll(invoice, constants.billingName, _.get(data.customer, 'firstName', '') + ' ' + _.get(data.customer, 'lastName', ''));
    invoice = replaceAll(invoice, constants.billingAddress, _.get(data.customer, 'address', ''));

    invoice = replaceAll(invoice, constants.billingCityStateZip, customerCityStateZip);

    invoice = replaceAll(invoice, constants.billingPhone1, formatPhoneNumber(_.get(data.customer, 'phoneNumber', '')));
    invoice = replaceAll(invoice, constants.billingPhone2, formatPhoneNumber(_.get(data.customer, 'workNumber', '')));
  }

  // product info
  invoice = replaceAll(invoice, constants.productItem, _.get(data.ticket, 'item', ''));
  invoice = replaceAll(invoice, constants.productBrand, _.get(data.ticket, 'brand', ''));
  invoice = replaceAll(invoice, constants.productModel, _.get(data.ticket, 'model', ''));
  invoice = replaceAll(invoice, constants.productSerial, _.get(data.ticket, 'serialNumber', ''));
  invoice = replaceAll(invoice, constants.productDate, _.get(data.ticket, 'dateOfPurchase', ''));

  // customer complaints
  var complaintTpl =  fs.readFileSync(constants.complaintTemplate, 'utf8');
  var complaintReplace = '';
  _.each(_.get(data.ticket, 'customerComplaint', '').split('\n'), function(line) {
    if (!line) {
      return true;
    }

    complaintReplace += replaceAll(complaintTpl, constants.ticketComplaintLine, line);
  });

  invoice = replaceAll(invoice, constants.ticketComplaint, complaintReplace);

  //parts list
  var partTpl =  fs.readFileSync(constants.partTemplate, 'utf8');
  var partListReplace = '';
  _.each(_.get(data.ticket, 'parts', []), function(part) {
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
  _.each(_.get(data.ticket, 'serviceDescription', '').split('\n'), function(line) {
    if (!line) {
      return true;
    }

    serviceNotesReplace += replaceAll(serviceNotesTpl, constants.ticketServiceNotesLine, line);
  });

  invoice = replaceAll(invoice, constants.ticketServiceNotes, serviceNotesReplace);

  // service call list
  var serviceCallTpl =  fs.readFileSync(constants.serviceCallTemplate, 'utf8');
  var serviceCallListReplace = '';
  _.each(_.get(data.ticket, 'serviceCalls', []), function(sc) {
    var serviceCallCopy = serviceCallTpl;
    var dateTimeRange = formatDateTimeRange(_.get(sc, 'serviceDate', ''));
    serviceCallCopy = replaceAll(serviceCallCopy, constants.ticketServiceCallListDateTime, dateTimeRange);
    serviceCallCopy = replaceAll(serviceCallCopy, constants.ticketServiceCallListTech, _.get(sc, 'tech', ''));

    serviceCallListReplace += serviceCallCopy;
  });

  invoice = replaceAll(invoice, constants.ticketServiceCallList, serviceCallListReplace);

  // payment list
  var paymentTpl =  fs.readFileSync(constants.paymentTemplate, 'utf8');
  var paymentListReplace = '';
  _.each(_.get(data.ticket, 'payments', []), function(payment) {
    var paymentCopy = paymentTpl;
    paymentCopy = replaceAll(paymentCopy, constants.ticketPaymentListPaymentDate, _.get(payment, 'paymentDate', ''));

    var pymntType = constants.paymentTypes[payment.paymentType] || '';
    paymentCopy = replaceAll(paymentCopy, constants.ticketPaymentListPaymentType, pymntType);
    paymentCopy = replaceAll(paymentCopy, constants.ticketPaymentListPaymentAmount, formatCurrency(_.get(payment, 'paymentAmount', 0) * -1));

    paymentListReplace += paymentCopy;
  });

  invoice = replaceAll(invoice, constants.ticketPaymentList, paymentListReplace);

  // totals
  if (data.ticket.hideCustomerTotals) {
    invoice = replaceAll(invoice, constants.underlineTotals, constants.underlineTotals.replace(/_/g, ''));
    invoice = replaceFirst(invoice, constants.ticketSubtotal, '');
    invoice = replaceFirst(invoice, constants.ticketTax, '');
    invoice = replaceFirst(invoice, constants.ticketTotal, '');
    invoice = replaceFirst(invoice, constants.ticketAmountPaid, '');
    invoice = replaceFirst(invoice, constants.ticketBalanceDue, '');
  }

  invoice = replaceAll(invoice, constants.ticketSubtotal, formatCurrency(_.get(data.ticket, 'subtotal', 0)));
  invoice = replaceAll(invoice, constants.ticketTax, formatCurrency(_.get(data.ticket, 'tax', 0)));
  invoice = replaceAll(invoice, constants.ticketTotal, formatCurrency(_.get(data.ticket, 'total', 0)));
  invoice = replaceAll(invoice, constants.ticketAmountPaid, formatCurrency(_.get(data.ticket, 'amountPaid', 0) * -1));
  invoice = replaceAll(invoice, constants.ticketBalanceDue, formatCurrency(_.get(data.ticket, 'balanceDue', 0)));

  return invoice;
}
