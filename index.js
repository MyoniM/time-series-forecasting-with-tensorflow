let input_dataset = [];
let result = [];
let data_raw = [];
let sma_vec = [];
let window_size = 50;
let trainingsize = 70;

$(document).ready(function () {
  $('select').formSelect();
});

function loadData() {
  $('#btn_fetch_data').hide();
  $('#load_fetch_data').show();

  const data = gotten_data_raw;

  let message = '';
  $('#div_container_linegraph').show();

  let symbol = data['name'];

  data_raw = [];
  sma_vec = [];

  for (let week of data['data']) {
    data_raw.push({ timestamp: week['date'], price: parseFloat(week['value']) });
  }

  data_raw.reverse();

  message = 'Symbol: ' + symbol;

  $('#btn_fetch_data').show();
  $('#load_fetch_data').hide();
  $('#div_linegraph_data_title').text(message);

  if (data_raw.length > 0) {
    let timestamps = data_raw.map(function (val) {
      return val['timestamp'];
    });
    let prices = data_raw.map(function (val) {
      return val['price'];
    });

    let graph_plot = document.getElementById('div_linegraph_data');
    Plotly.newPlot(graph_plot, [{ x: timestamps, y: prices, name: 'Crude Oil Prices' }], { margin: { t: 0 } });
  }

  $('#div_container_getsma').show();
  $('#div_container_getsmafirst').hide();
}

function onClickDisplaySMA() {
  $('#btn_draw_sma').hide();
  $('#load_draw_sma').show();
  $('#div_container_sma').show();

  window_size = parseInt(document.getElementById('input_windowsize').value);

  sma_vec = ComputeSMA(data_raw, window_size);

  let sma = sma_vec.map(function (val) {
    return val['avg'];
  });
  let prices = data_raw.map(function (val) {
    return val['price'];
  });

  let timestamps_a = data_raw.map(function (val) {
    return val['timestamp'];
  });
  let timestamps_b = data_raw
    .map(function (val) {
      return val['timestamp'];
    })
    .splice(window_size, data_raw.length);

  let graph_plot = document.getElementById('div_linegraph_sma');
  Plotly.newPlot(graph_plot, [{ x: timestamps_a, y: prices, name: 'Crude Oil Price' }], { margin: { t: 0 } });
  Plotly.plot(graph_plot, [{ x: timestamps_b, y: sma, name: 'SMA' }], { margin: { t: 0 } });

  $('#div_linegraph_sma_title').text('Crude Oil Price and Simple Moving Average (window: ' + window_size + ')');
  $('#btn_draw_sma').show();
  $('#load_draw_sma').hide();

  $('#div_container_train').show();
  $('#div_container_trainfirst').hide();

  displayTrainingData();
}

function displayTrainingData() {
  $('#div_container_trainingdata').show();

  let set = sma_vec.map(function (val) {
    return val['set'];
  });
  let data_output = '';
  for (let index = 0; index < 10; index++) {
    data_output +=
      '<tr><td width="20px">' +
      (index + 1) +
      '</td><td>[' +
      set[index]
        .map(function (val) {
          return (Math.round(val['price'] * 10000) / 10000).toString();
        })
        .toString() +
      ']</td><td>' +
      sma_vec[index]['avg'] +
      '</td></tr>';
  }

  data_output =
    "<table class='striped'>" +
    "<thead><tr><th scope='col'>#</th>" +
    "<th scope='col'>Input (X)</th>" +
    "<th scope='col'>Label (Y)</th></thead>" +
    '<tbody>' +
    data_output +
    '</tbody>' +
    '</table>';

  $('#div_trainingdata').html(data_output);
}

async function onClickTrainModel() {
  let epoch_loss = [];

  $('#div_container_training').show();
  $('#btn_draw_trainmodel').hide();

  document.getElementById('div_traininglog').innerHTML = '';

  let inputs = sma_vec.map(function (inp_f) {
    return inp_f['set'].map(function (val) {
      return val['price'];
    });
  });
  let outputs = sma_vec.map(function (outp_f) {
    return outp_f['avg'];
  });

  trainingsize = parseInt(document.getElementById('input_trainingsize').value);
  let n_epochs = parseInt(document.getElementById('input_epochs').value);
  let learningrate = parseFloat(document.getElementById('input_learningrate').value);
  let n_hiddenlayers = parseInt(document.getElementById('input_hiddenlayers').value);

  inputs = inputs.slice(0, Math.floor((trainingsize / 100) * inputs.length));
  outputs = outputs.slice(0, Math.floor((trainingsize / 100) * outputs.length));

  let callback = function (epoch, log) {
    let logHtml = document.getElementById('div_traininglog').innerHTML;
    logHtml =
      '<div>Epoch: ' + (epoch + 1) + ' (of ' + n_epochs + ')' + ', loss: ' + '<span style="color:red;"> ' + log.loss + '</span>' + '</div>' + logHtml;

    epoch_loss.push(log.loss);

    document.getElementById('div_traininglog').innerHTML = logHtml;
    document.getElementById('div_training_progressbar').style.width = Math.ceil((epoch + 1) * (100 / n_epochs)).toString() + '%';
    document.getElementById('div_training_progressbar').innerHTML = Math.ceil((epoch + 1) * (100 / n_epochs)).toString() + '%';

    let graph_plot = document.getElementById('div_linegraph_trainloss');
    Plotly.newPlot(graph_plot, [{ x: Array.from({ length: epoch_loss.length }, (v, k) => k + 1), y: epoch_loss, name: 'Loss' }], {
      margin: { t: 0 },
    });
  };

  result = await trainModel(inputs, outputs, window_size, n_epochs, learningrate, n_hiddenlayers, callback);
  // start validation after training is complete
  onClickValidate();
  onClickPredict();

  let logHtml = document.getElementById('div_traininglog').innerHTML;
  logHtml = '<div>Model train completed</div>' + logHtml;
  document.getElementById('div_traininglog').innerHTML = logHtml;

  $('#div_container_validate').show();
  $('#div_container_validatefirst').hide();
  $('#div_container_predict').show();
  $('#div_container_predictfirst').hide();
}

function onClickValidate() {
  $('#div_container_validating').show();
  $('#load_validating').show();
  $('#btn_validation').hide();

  let inputs = sma_vec.map(function (inp_f) {
    return inp_f['set'].map(function (val) {
      return val['price'];
    });
  });

  // validate on training
  let val_train_x = inputs.slice(0, Math.floor((trainingsize / 100) * inputs.length));

  let val_train_y = makePredictions(val_train_x, result['model'], result['normalize']);

  // validate on unseen
  let val_unseen_x = inputs.slice(Math.floor((trainingsize / 100) * inputs.length), inputs.length);
  let val_unseen_y = makePredictions(val_unseen_x, result['model'], result['normalize']);

  let timestamps_a = data_raw.map(function (val) {
    return val['timestamp'];
  });

  let timestamps_b = data_raw
    .map(function (val) {
      return val['timestamp'];
    })
    .splice(window_size, data_raw.length - Math.floor(((100 - trainingsize) / 100) * data_raw.length)); //.splice(window_size, data_raw.length);

  let timestamps_c = data_raw
    .map(function (val) {
      return val['timestamp'];
    })
    .splice(window_size + Math.floor((trainingsize / 100) * inputs.length), inputs.length);

  let sma = sma_vec.map(function (val) {
    return val['avg'];
  });
  let prices = data_raw.map(function (val) {
    return val['price'];
  });
  sma = sma.slice(0, Math.floor((trainingsize / 100) * sma.length));

  let graph_plot = document.getElementById('div_validation_graph');
  Plotly.newPlot(graph_plot, [{ x: timestamps_a, y: prices, name: 'Actual Price' }], { margin: { t: 0 } });
  Plotly.plot(graph_plot, [{ x: timestamps_b, y: sma, name: 'Training Label (SMA)' }], { margin: { t: 0 } });
  Plotly.plot(graph_plot, [{ x: timestamps_b, y: val_train_y, name: 'Predicted (train)' }], { margin: { t: 0 } });
  Plotly.plot(graph_plot, [{ x: timestamps_c, y: val_unseen_y, name: 'Predicted (test)' }], { margin: { t: 0 } });

  $('#load_validating').hide();
}

function ComputeSMA(data, window_size) {
  let r_avgs = [],
    avg_prev = 0;
  for (let i = 0; i <= data.length - window_size; i++) {
    let curr_avg = 0.0,
      t = i + window_size;
    for (let k = i; k < t && k <= data.length; k++) {
      curr_avg += data[k]['price'] / window_size;
    }
    r_avgs.push({ set: data.slice(i, i + window_size), avg: curr_avg });
    avg_prev = curr_avg;
  }
  return r_avgs;
}

async function onClickPredict() {
  $('#div_container_predicting').show();
  $('#load_predicting').show();
  $('#btn_prediction').hide();

  let inputs = sma_vec.map(function (inp_f) {
    return inp_f['set'].map(function (val) {
      return val['price'];
    });
  });

  let pred_X = [inputs[inputs.length - 1]];

  pred_X = pred_X.slice(Math.floor((trainingsize / 100) * pred_X.length), pred_X.length);

  let pred_y = makePredictions(pred_X, result['model'], result['normalize']);

  window_size = parseInt(document.getElementById('input_windowsize').value);

  let timestamps_d = data_raw
    .map(function (val) {
      return val['timestamp'];
    })
    .splice(data_raw.length - window_size, data_raw.length);

  // date
  let last_date = new Date(timestamps_d[timestamps_d.length - 1]);
  add_days = 7;

  last_date.setDate(last_date.getDate() + add_days);
  let next_date = formatDate(last_date.toString());
  let timestamps_e = [next_date];

  let graph_plot = document.getElementById('div_prediction_graph');
  Plotly.newPlot(graph_plot, [{ x: timestamps_d, y: pred_X[0], name: 'Latest Trends' }], { margin: { t: 0 } });
  Plotly.plot(graph_plot, [{ x: timestamps_e, y: pred_y, name: 'Predicted Price' }], { margin: { t: 0 } });

  $('#load_predicting').hide();
}

function formatDate(date) {
  var d = new Date(date),
    month = '' + (d.getMonth() + 1),
    day = '' + d.getDate(),
    year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}

function run() {
  loadData();
  onClickDisplaySMA();
}
document.addEventListener('DOMContentLoaded', run);

let gotten_data_raw = {
  name: 'Crude Oil Prices WTI',
  interval: 'weekly',
  unit: 'dollars per barrel',
  data: [
    {
      date: '2023-02-10',
      value: '77.51',
    },
    {
      date: '2023-02-03',
      value: '76.51',
    },
    {
      date: '2023-01-27',
      value: '80.33',
    },
    {
      date: '2023-01-20',
      value: '80.34',
    },
    {
      date: '2023-01-13',
      value: '77.1',
    },
    {
      date: '2023-01-06',
      value: '74.27',
    },
    {
      date: '2022-12-30',
      value: '79.23',
    },
    {
      date: '2022-12-23',
      value: '77.28',
    },
    {
      date: '2022-12-16',
      value: '75.12',
    },
    {
      date: '2022-12-09',
      value: '73.06',
    },
    {
      date: '2022-12-02',
      value: '79.29',
    },
    {
      date: '2022-11-25',
      value: '78.74',
    },
    {
      date: '2022-11-18',
      value: '84.02',
    },
    {
      date: '2022-11-11',
      value: '88.41',
    },
    {
      date: '2022-11-04',
      value: '89.14',
    },
    {
      date: '2022-10-28',
      value: '87.87',
    },
    {
      date: '2022-10-21',
      value: '85.36',
    },
    {
      date: '2022-10-14',
      value: '88.97',
    },
    {
      date: '2022-10-07',
      value: '88.22',
    },
    {
      date: '2022-09-30',
      value: '80.08',
    },
    {
      date: '2022-09-23',
      value: '83.46',
    },
    {
      date: '2022-09-16',
      value: '87.24',
    },
    {
      date: '2022-09-09',
      value: '85.29',
    },
    {
      date: '2022-09-02',
      value: '90.79',
    },
    {
      date: '2022-08-26',
      value: '94.47',
    },
    {
      date: '2022-08-19',
      value: '91.81',
    },
    {
      date: '2022-08-12',
      value: '94.65',
    },
    {
      date: '2022-08-05',
      value: '94.01',
    },
    {
      date: '2022-07-29',
      value: '99.6',
    },
    {
      date: '2022-07-22',
      value: '102.24',
    },
    {
      date: '2022-07-15',
      value: '99.92',
    },
    {
      date: '2022-07-08',
      value: '103.32',
    },
    {
      date: '2022-07-01',
      value: '110.96',
    },
    {
      date: '2022-06-24',
      value: '107.88',
    },
    {
      date: '2022-06-17',
      value: '116.46',
    },
    {
      date: '2022-06-10',
      value: '120.43',
    },
    {
      date: '2022-06-03',
      value: '116.37',
    },
    {
      date: '2022-05-27',
      value: '113.38',
    },
    {
      date: '2022-05-20',
      value: '112.18',
    },
    {
      date: '2022-05-13',
      value: '105.0',
    },
    {
      date: '2022-05-06',
      value: '106.69',
    },
    {
      date: '2022-04-29',
      value: '102.85',
    },
    {
      date: '2022-04-22',
      value: '104.02',
    },
    {
      date: '2022-04-15',
      value: '101.46',
    },
    {
      date: '2022-04-08',
      value: '99.21',
    },
    {
      date: '2022-04-01',
      value: '103.89',
    },
    {
      date: '2022-03-25',
      value: '113.69',
    },
    {
      date: '2022-03-18',
      value: '100.43',
    },
    {
      date: '2022-03-11',
      value: '113.39',
    },
    {
      date: '2022-03-04',
      value: '106.8',
    },
    {
      date: '2022-02-25',
      value: '92.18',
    },
    {
      date: '2022-02-18',
      value: '92.89',
    },
    {
      date: '2022-02-11',
      value: '90.61',
    },
    {
      date: '2022-02-04',
      value: '89.6',
    },
    {
      date: '2022-01-28',
      value: '86.94',
    },
    {
      date: '2022-01-21',
      value: '85.93',
    },
    {
      date: '2022-01-14',
      value: '81.52',
    },
    {
      date: '2022-01-07',
      value: '77.86',
    },
    {
      date: '2021-12-31',
      value: '76.05',
    },
    {
      date: '2021-12-24',
      value: '71.63',
    },
    {
      date: '2021-12-17',
      value: '71.18',
    },
    {
      date: '2021-12-10',
      value: '71.31',
    },
    {
      date: '2021-12-03',
      value: '66.89',
    },
    {
      date: '2021-11-26',
      value: '77.79',
    },
    {
      date: '2021-11-19',
      value: '78.99',
    },
    {
      date: '2021-11-12',
      value: '81.93',
    },
    {
      date: '2021-11-05',
      value: '81.79',
    },
    {
      date: '2021-10-29',
      value: '83.84',
    },
    {
      date: '2021-10-22',
      value: '83.48',
    },
    {
      date: '2021-10-15',
      value: '81.18',
    },
    {
      date: '2021-10-08',
      value: '78.5',
    },
    {
      date: '2021-10-01',
      value: '75.45',
    },
    {
      date: '2021-09-24',
      value: '72.18',
    },
    {
      date: '2021-09-17',
      value: '71.69',
    },
    {
      date: '2021-09-10',
      value: '68.98',
    },
    {
      date: '2021-09-03',
      value: '69.15',
    },
    {
      date: '2021-08-27',
      value: '67.59',
    },
    {
      date: '2021-08-20',
      value: '65.05',
    },
    {
      date: '2021-08-13',
      value: '68.33',
    },
    {
      date: '2021-08-06',
      value: '69.5',
    },
    {
      date: '2021-07-30',
      value: '72.75',
    },
    {
      date: '2021-07-23',
      value: '69.68',
    },
    {
      date: '2021-07-16',
      value: '73.19',
    },
    {
      date: '2021-07-09',
      value: '73.35',
    },
    {
      date: '2021-07-02',
      value: '74.07',
    },
    {
      date: '2021-06-25',
      value: '73.48',
    },
    {
      date: '2021-06-18',
      value: '71.55',
    },
    {
      date: '2021-06-11',
      value: '70.11',
    },
    {
      date: '2021-06-04',
      value: '68.74',
    },
    {
      date: '2021-05-28',
      value: '66.4',
    },
    {
      date: '2021-05-21',
      value: '64.11',
    },
    {
      date: '2021-05-14',
      value: '65.07',
    },
    {
      date: '2021-05-07',
      value: '65.1',
    },
    {
      date: '2021-04-30',
      value: '63.47',
    },
    {
      date: '2021-04-23',
      value: '62.18',
    },
    {
      date: '2021-04-16',
      value: '61.93',
    },
    {
      date: '2021-04-09',
      value: '59.35',
    },
    {
      date: '2021-04-02',
      value: '60.66',
    },
    {
      date: '2021-03-26',
      value: '59.95',
    },
    {
      date: '2021-03-19',
      value: '63.22',
    },
    {
      date: '2021-03-12',
      value: '65.02',
    },
    {
      date: '2021-03-05',
      value: '62.29',
    },
    {
      date: '2021-02-26',
      value: '62.3',
    },
    {
      date: '2021-02-19',
      value: '60.17',
    },
    {
      date: '2021-02-12',
      value: '58.54',
    },
    {
      date: '2021-02-05',
      value: '55.39',
    },
    {
      date: '2021-01-29',
      value: '52.52',
    },
    {
      date: '2021-01-22',
      value: '52.82',
    },
    {
      date: '2021-01-15',
      value: '52.75',
    },
    {
      date: '2021-01-08',
      value: '50.09',
    },
    {
      date: '2021-01-01',
      value: '47.98',
    },
    {
      date: '2020-12-25',
      value: '47.73',
    },
    {
      date: '2020-12-18',
      value: '47.97',
    },
    {
      date: '2020-12-11',
      value: '46.04',
    },
    {
      date: '2020-12-04',
      value: '45.37',
    },
    {
      date: '2020-11-27',
      value: '44.4',
    },
    {
      date: '2020-11-20',
      value: '41.52',
    },
    {
      date: '2020-11-13',
      value: '40.66',
    },
    {
      date: '2020-11-06',
      value: '37.71',
    },
    {
      date: '2020-10-30',
      value: '37.32',
    },
    {
      date: '2020-10-23',
      value: '40.43',
    },
    {
      date: '2020-10-16',
      value: '40.33',
    },
    {
      date: '2020-10-09',
      value: '40.19',
    },
    {
      date: '2020-10-02',
      value: '38.99',
    },
    {
      date: '2020-09-25',
      value: '39.78',
    },
    {
      date: '2020-09-18',
      value: '39.55',
    },
    {
      date: '2020-09-11',
      value: '37.38',
    },
    {
      date: '2020-09-04',
      value: '41.84',
    },
    {
      date: '2020-08-28',
      value: '42.93',
    },
    {
      date: '2020-08-21',
      value: '42.73',
    },
    {
      date: '2020-08-14',
      value: '42.08',
    },
    {
      date: '2020-08-07',
      value: '41.57',
    },
    {
      date: '2020-07-31',
      value: '40.69',
    },
    {
      date: '2020-07-24',
      value: '41.34',
    },
    {
      date: '2020-07-17',
      value: '40.57',
    },
    {
      date: '2020-07-10',
      value: '40.44',
    },
    {
      date: '2020-07-03',
      value: '39.85',
    },
    {
      date: '2020-06-26',
      value: '39.22',
    },
    {
      date: '2020-06-19',
      value: '38.35',
    },
    {
      date: '2020-06-12',
      value: '37.87',
    },
    {
      date: '2020-06-05',
      value: '37.32',
    },
    {
      date: '2020-05-29',
      value: '34.19',
    },
    {
      date: '2020-05-22',
      value: '33.1',
    },
    {
      date: '2020-05-15',
      value: '26.4',
    },
    {
      date: '2020-05-08',
      value: '23.46',
    },
    {
      date: '2020-05-01',
      value: '15.71',
    },
    {
      date: '2020-04-24',
      value: '3.32',
    },
    {
      date: '2020-04-17',
      value: '20.12',
    },
    {
      date: '2020-04-10',
      value: '24.41',
    },
    {
      date: '2020-04-03',
      value: '21.69',
    },
    {
      date: '2020-03-27',
      value: '19.44',
    },
    {
      date: '2020-03-20',
      value: '24.19',
    },
    {
      date: '2020-03-13',
      value: '32.39',
    },
    {
      date: '2020-03-06',
      value: '45.57',
    },
    {
      date: '2020-02-28',
      value: '48.36',
    },
    {
      date: '2020-02-21',
      value: '53.14',
    },
    {
      date: '2020-02-14',
      value: '50.83',
    },
    {
      date: '2020-02-07',
      value: '50.36',
    },
    {
      date: '2020-01-31',
      value: '52.7',
    },
    {
      date: '2020-01-24',
      value: '56.15',
    },
    {
      date: '2020-01-17',
      value: '58.29',
    },
    {
      date: '2020-01-10',
      value: '60.84',
    },
    {
      date: '2020-01-03',
      value: '62.09',
    },
    {
      date: '2019-12-27',
      value: '61.29',
    },
    {
      date: '2019-12-20',
      value: '60.75',
    },
    {
      date: '2019-12-13',
      value: '59.25',
    },
    {
      date: '2019-12-06',
      value: '57.64',
    },
    {
      date: '2019-11-29',
      value: '58.07',
    },
    {
      date: '2019-11-22',
      value: '56.9',
    },
    {
      date: '2019-11-15',
      value: '56.85',
    },
    {
      date: '2019-11-08',
      value: '56.69',
    },
    {
      date: '2019-11-01',
      value: '55.17',
    },
    {
      date: '2019-10-25',
      value: '55.2',
    },
    {
      date: '2019-10-18',
      value: '53.49',
    },
    {
      date: '2019-10-11',
      value: '53.27',
    },
    {
      date: '2019-10-04',
      value: '53.12',
    },
    {
      date: '2019-09-27',
      value: '56.9',
    },
    {
      date: '2019-09-20',
      value: '59.33',
    },
    {
      date: '2019-09-13',
      value: '56.16',
    },
    {
      date: '2019-09-06',
      value: '55.73',
    },
    {
      date: '2019-08-30',
      value: '55.21',
    },
    {
      date: '2019-08-23',
      value: '55.5',
    },
    {
      date: '2019-08-16',
      value: '55.31',
    },
    {
      date: '2019-08-09',
      value: '53.28',
    },
    {
      date: '2019-08-02',
      value: '56.55',
    },
    {
      date: '2019-07-26',
      value: '56.05',
    },
    {
      date: '2019-07-19',
      value: '56.74',
    },
    {
      date: '2019-07-12',
      value: '59.02',
    },
    {
      date: '2019-07-05',
      value: '57.32',
    },
    {
      date: '2019-06-28',
      value: '58.38',
    },
    {
      date: '2019-06-21',
      value: '54.75',
    },
    {
      date: '2019-06-14',
      value: '52.52',
    },
    {
      date: '2019-06-07',
      value: '52.97',
    },
    {
      date: '2019-05-31',
      value: '56.93',
    },
    {
      date: '2019-05-24',
      value: '60.72',
    },
    {
      date: '2019-05-17',
      value: '62.1',
    },
    {
      date: '2019-05-10',
      value: '61.81',
    },
    {
      date: '2019-05-03',
      value: '62.9',
    },
    {
      date: '2019-04-26',
      value: '65.28',
    },
    {
      date: '2019-04-19',
      value: '63.8',
    },
    {
      date: '2019-04-12',
      value: '64.1',
    },
    {
      date: '2019-04-05',
      value: '62.36',
    },
    {
      date: '2019-03-29',
      value: '59.49',
    },
    {
      date: '2019-03-22',
      value: '59.44',
    },
    {
      date: '2019-03-15',
      value: '57.81',
    },
    {
      date: '2019-03-08',
      value: '56.35',
    },
    {
      date: '2019-03-01',
      value: '56.12',
    },
    {
      date: '2019-02-22',
      value: '56.74',
    },
    {
      date: '2019-02-15',
      value: '53.88',
    },
    {
      date: '2019-02-08',
      value: '53.53',
    },
    {
      date: '2019-02-01',
      value: '53.63',
    },
    {
      date: '2019-01-25',
      value: '52.88',
    },
    {
      date: '2019-01-18',
      value: '51.92',
    },
    {
      date: '2019-01-11',
      value: '50.78',
    },
    {
      date: '2019-01-04',
      value: '47.0',
    },
    {
      date: '2018-12-28',
      value: '45.22',
    },
    {
      date: '2018-12-21',
      value: '46.98',
    },
    {
      date: '2018-12-14',
      value: '51.54',
    },
    {
      date: '2018-12-07',
      value: '52.63',
    },
    {
      date: '2018-11-30',
      value: '51.01',
    },
    {
      date: '2018-11-23',
      value: '54.99',
    },
    {
      date: '2018-11-16',
      value: '56.92',
    },
    {
      date: '2018-11-09',
      value: '61.57',
    },
    {
      date: '2018-11-02',
      value: '65.06',
    },
    {
      date: '2018-10-26',
      value: '67.43',
    },
    {
      date: '2018-10-19',
      value: '70.24',
    },
    {
      date: '2018-10-12',
      value: '72.96',
    },
    {
      date: '2018-10-05',
      value: '75.13',
    },
    {
      date: '2018-09-28',
      value: '72.84',
    },
    {
      date: '2018-09-21',
      value: '70.28',
    },
    {
      date: '2018-09-14',
      value: '68.96',
    },
    {
      date: '2018-09-07',
      value: '68.51',
    },
    {
      date: '2018-08-31',
      value: '69.66',
    },
    {
      date: '2018-08-24',
      value: '68.1',
    },
    {
      date: '2018-08-17',
      value: '66.15',
    },
    {
      date: '2018-08-10',
      value: '67.9',
    },
    {
      date: '2018-08-03',
      value: '69.46',
    },
    {
      date: '2018-07-27',
      value: '70.01',
    },
    {
      date: '2018-07-20',
      value: '68.95',
    },
    {
      date: '2018-07-13',
      value: '71.96',
    },
    {
      date: '2018-07-06',
      value: '73.73',
    },
    {
      date: '2018-06-29',
      value: '74.03',
    },
    {
      date: '2018-06-22',
      value: '66.32',
    },
    {
      date: '2018-06-15',
      value: '66.21',
    },
    {
      date: '2018-06-08',
      value: '65.35',
    },
    {
      date: '2018-06-01',
      value: '66.96',
    },
    {
      date: '2018-05-25',
      value: '70.98',
    },
    {
      date: '2018-05-18',
      value: '71.3',
    },
    {
      date: '2018-05-11',
      value: '70.56',
    },
    {
      date: '2018-05-04',
      value: '68.38',
    },
    {
      date: '2018-04-27',
      value: '67.91',
    },
    {
      date: '2018-04-20',
      value: '67.55',
    },
    {
      date: '2018-04-13',
      value: '66.02',
    },
    {
      date: '2018-04-06',
      value: '63.07',
    },
    {
      date: '2018-03-30',
      value: '64.97',
    },
    {
      date: '2018-03-23',
      value: '64.11',
    },
    {
      date: '2018-03-16',
      value: '61.28',
    },
    {
      date: '2018-03-09',
      value: '61.65',
    },
    {
      date: '2018-03-02',
      value: '62.07',
    },
    {
      date: '2018-02-23',
      value: '62.47',
    },
    {
      date: '2018-02-16',
      value: '60.56',
    },
    {
      date: '2018-02-09',
      value: '62.01',
    },
    {
      date: '2018-02-02',
      value: '65.32',
    },
    {
      date: '2018-01-26',
      value: '65.14',
    },
    {
      date: '2018-01-19',
      value: '63.77',
    },
    {
      date: '2018-01-12',
      value: '63.26',
    },
    {
      date: '2018-01-05',
      value: '61.36',
    },
    {
      date: '2017-12-29',
      value: '59.88',
    },
    {
      date: '2017-12-22',
      value: '57.87',
    },
    {
      date: '2017-12-15',
      value: '57.17',
    },
    {
      date: '2017-12-08',
      value: '56.92',
    },
    {
      date: '2017-12-01',
      value: '57.81',
    },
    {
      date: '2017-11-24',
      value: '57.47',
    },
    {
      date: '2017-11-17',
      value: '55.81',
    },
    {
      date: '2017-11-10',
      value: '57.05',
    },
    {
      date: '2017-11-03',
      value: '54.59',
    },
    {
      date: '2017-10-27',
      value: '52.51',
    },
    {
      date: '2017-10-20',
      value: '51.74',
    },
    {
      date: '2017-10-13',
      value: '50.77',
    },
    {
      date: '2017-10-06',
      value: '50.23',
    },
    {
      date: '2017-09-29',
      value: '51.77',
    },
    {
      date: '2017-09-22',
      value: '50.12',
    },
    {
      date: '2017-09-15',
      value: '49.07',
    },
    {
      date: '2017-09-08',
      value: '48.58',
    },
    {
      date: '2017-09-01',
      value: '46.68',
    },
    {
      date: '2017-08-25',
      value: '47.68',
    },
    {
      date: '2017-08-18',
      value: '47.52',
    },
    {
      date: '2017-08-11',
      value: '49.08',
    },
    {
      date: '2017-08-04',
      value: '49.52',
    },
    {
      date: '2017-07-28',
      value: '48.27',
    },
    {
      date: '2017-07-21',
      value: '46.41',
    },
    {
      date: '2017-07-14',
      value: '45.51',
    },
    {
      date: '2017-07-07',
      value: '44.96',
    },
    {
      date: '2017-06-30',
      value: '44.63',
    },
    {
      date: '2017-06-23',
      value: '43.09',
    },
    {
      date: '2017-06-16',
      value: '45.30',
    },
    {
      date: '2017-06-09',
      value: '46.57',
    },
    {
      date: '2017-06-02',
      value: '48.48',
    },
    {
      date: '2017-05-26',
      value: '50.21',
    },
    {
      date: '2017-05-19',
      value: '49.24',
    },
    {
      date: '2017-05-12',
      value: '47.04',
    },
    {
      date: '2017-05-05',
      value: '47.21',
    },
    {
      date: '2017-04-28',
      value: '49.12',
    },
    {
      date: '2017-04-21',
      value: '51.09',
    },
    {
      date: '2017-04-14',
      value: '53.19',
    },
    {
      date: '2017-04-07',
      value: '51.26',
    },
    {
      date: '2017-03-31',
      value: '49.14',
    },
    {
      date: '2017-03-24',
      value: '47.28',
    },
    {
      date: '2017-03-17',
      value: '48.03',
    },
    {
      date: '2017-03-10',
      value: '50.50',
    },
    {
      date: '2017-03-03',
      value: '53.56',
    },
    {
      date: '2017-02-24',
      value: '54.03',
    },
    {
      date: '2017-02-17',
      value: '53.22',
    },
    {
      date: '2017-02-10',
      value: '52.88',
    },
    {
      date: '2017-02-03',
      value: '53.33',
    },
    {
      date: '2017-01-27',
      value: '52.74',
    },
    {
      date: '2017-01-20',
      value: '51.82',
    },
    {
      date: '2017-01-13',
      value: '52.07',
    },
    {
      date: '2017-01-06',
      value: '53.34',
    },
    {
      date: '2016-12-30',
      value: '53.60',
    },
    {
      date: '2016-12-23',
      value: '51.95',
    },
    {
      date: '2016-12-16',
      value: '51.91',
    },
    {
      date: '2016-12-09',
      value: '50.97',
    },
    {
      date: '2016-12-02',
      value: '48.63',
    },
    {
      date: '2016-11-25',
      value: '47.25',
    },
    {
      date: '2016-11-18',
      value: '45.15',
    },
    {
      date: '2016-11-11',
      value: '44.61',
    },
    {
      date: '2016-11-04',
      value: '45.51',
    },
    {
      date: '2016-10-28',
      value: '49.36',
    },
    {
      date: '2016-10-21',
      value: '50.56',
    },
    {
      date: '2016-10-14',
      value: '50.29',
    },
    {
      date: '2016-10-07',
      value: '49.48',
    },
    {
      date: '2016-09-30',
      value: '46.55',
    },
    {
      date: '2016-09-23',
      value: '44.59',
    },
    {
      date: '2016-09-16',
      value: '44.34',
    },
    {
      date: '2016-09-09',
      value: '45.96',
    },
    {
      date: '2016-09-02',
      value: '45.11',
    },
    {
      date: '2016-08-26',
      value: '47.05',
    },
    {
      date: '2016-08-19',
      value: '47.16',
    },
    {
      date: '2016-08-12',
      value: '43.11',
    },
    {
      date: '2016-08-05',
      value: '40.82',
    },
    {
      date: '2016-07-29',
      value: '41.83',
    },
    {
      date: '2016-07-22',
      value: '44.44',
    },
    {
      date: '2016-07-15',
      value: '45.60',
    },
    {
      date: '2016-07-08',
      value: '46.17',
    },
    {
      date: '2016-07-01',
      value: '48.17',
    },
    {
      date: '2016-06-24',
      value: '48.71',
    },
    {
      date: '2016-06-17',
      value: '47.89',
    },
    {
      date: '2016-06-10',
      value: '50.18',
    },
    {
      date: '2016-06-03',
      value: '49.00',
    },
    {
      date: '2016-05-27',
      value: '48.72',
    },
    {
      date: '2016-05-20',
      value: '47.99',
    },
    {
      date: '2016-05-13',
      value: '45.44',
    },
    {
      date: '2016-05-06',
      value: '44.22',
    },
    {
      date: '2016-04-29',
      value: '44.30',
    },
    {
      date: '2016-04-22',
      value: '41.86',
    },
    {
      date: '2016-04-15',
      value: '41.23',
    },
    {
      date: '2016-04-08',
      value: '36.72',
    },
    {
      date: '2016-04-01',
      value: '36.82',
    },
    {
      date: '2016-03-25',
      value: '39.45',
    },
    {
      date: '2016-03-18',
      value: '38.32',
    },
    {
      date: '2016-03-11',
      value: '37.69',
    },
    {
      date: '2016-03-04',
      value: '34.43',
    },
    {
      date: '2016-02-26',
      value: '31.32',
    },
    {
      date: '2016-02-19',
      value: '30.02',
    },
    {
      date: '2016-02-12',
      value: '28.14',
    },
    {
      date: '2016-02-05',
      value: '31.26',
    },
    {
      date: '2016-01-29',
      value: '31.81',
    },
    {
      date: '2016-01-22',
      value: '29.19',
    },
    {
      date: '2016-01-15',
      value: '30.59',
    },
    {
      date: '2016-01-08',
      value: '34.65',
    },
    {
      date: '2016-01-01',
      value: '36.99',
    },
    {
      date: '2015-12-25',
      value: '36.26',
    },
    {
      date: '2015-12-18',
      value: '35.78',
    },
    {
      date: '2015-12-11',
      value: '36.93',
    },
    {
      date: '2015-12-04',
      value: '40.40',
    },
    {
      date: '2015-11-27',
      value: '40.49',
    },
    {
      date: '2015-11-20',
      value: '40.62',
    },
    {
      date: '2015-11-13',
      value: '42.70',
    },
    {
      date: '2015-11-06',
      value: '45.98',
    },
    {
      date: '2015-10-30',
      value: '44.99',
    },
    {
      date: '2015-10-23',
      value: '45.16',
    },
    {
      date: '2015-10-16',
      value: '46.82',
    },
    {
      date: '2015-10-09',
      value: '48.36',
    },
    {
      date: '2015-10-02',
      value: '45.00',
    },
    {
      date: '2015-09-25',
      value: '45.57',
    },
    {
      date: '2015-09-18',
      value: '45.48',
    },
    {
      date: '2015-09-11',
      value: '45.16',
    },
    {
      date: '2015-09-04',
      value: '46.73',
    },
    {
      date: '2015-08-28',
      value: '40.73',
    },
    {
      date: '2015-08-21',
      value: '41.34',
    },
    {
      date: '2015-08-14',
      value: '43.20',
    },
    {
      date: '2015-08-07',
      value: '44.94',
    },
    {
      date: '2015-07-31',
      value: '47.91',
    },
    {
      date: '2015-07-24',
      value: '49.21',
    },
    {
      date: '2015-07-17',
      value: '51.68',
    },
    {
      date: '2015-07-10',
      value: '52.38',
    },
    {
      date: '2015-07-03',
      value: '57.92',
    },
    {
      date: '2015-06-26',
      value: '60.01',
    },
    {
      date: '2015-06-19',
      value: '59.89',
    },
    {
      date: '2015-06-12',
      value: '60.07',
    },
    {
      date: '2015-06-05',
      value: '59.66',
    },
    {
      date: '2015-05-29',
      value: '58.19',
    },
    {
      date: '2015-05-22',
      value: '58.95',
    },
    {
      date: '2015-05-15',
      value: '60.01',
    },
    {
      date: '2015-05-08',
      value: '59.73',
    },
    {
      date: '2015-05-01',
      value: '57.98',
    },
    {
      date: '2015-04-24',
      value: '56.14',
    },
    {
      date: '2015-04-17',
      value: '54.78',
    },
    {
      date: '2015-04-10',
      value: '51.78',
    },
    {
      date: '2015-04-03',
      value: '48.91',
    },
    {
      date: '2015-03-27',
      value: '48.68',
    },
    {
      date: '2015-03-20',
      value: '44.39',
    },
    {
      date: '2015-03-13',
      value: '47.69',
    },
    {
      date: '2015-03-06',
      value: '50.38',
    },
    {
      date: '2015-02-27',
      value: '49.16',
    },
    {
      date: '2015-02-20',
      value: '51.69',
    },
    {
      date: '2015-02-13',
      value: '51.14',
    },
    {
      date: '2015-02-06',
      value: '50.58',
    },
    {
      date: '2015-01-30',
      value: '45.32',
    },
    {
      date: '2015-01-23',
      value: '46.46',
    },
    {
      date: '2015-01-16',
      value: '47.07',
    },
    {
      date: '2015-01-09',
      value: '48.77',
    },
    {
      date: '2015-01-02',
      value: '53.44',
    },
    {
      date: '2014-12-26',
      value: '55.58',
    },
    {
      date: '2014-12-19',
      value: '55.89',
    },
    {
      date: '2014-12-12',
      value: '61.14',
    },
    {
      date: '2014-12-05',
      value: '67.18',
    },
    {
      date: '2014-11-28',
      value: '72.36',
    },
    {
      date: '2014-11-21',
      value: '75.38',
    },
    {
      date: '2014-11-14',
      value: '76.50',
    },
    {
      date: '2014-11-07',
      value: '78.24',
    },
    {
      date: '2014-10-31',
      value: '81.29',
    },
    {
      date: '2014-10-24',
      value: '82.12',
    },
    {
      date: '2014-10-17',
      value: '82.88',
    },
    {
      date: '2014-10-10',
      value: '87.63',
    },
    {
      date: '2014-10-03',
      value: '91.44',
    },
    {
      date: '2014-09-26',
      value: '93.15',
    },
    {
      date: '2014-09-19',
      value: '93.52',
    },
    {
      date: '2014-09-12',
      value: '92.43',
    },
    {
      date: '2014-09-05',
      value: '94.06',
    },
    {
      date: '2014-08-29',
      value: '96.25',
    },
    {
      date: '2014-08-22',
      value: '94.95',
    },
    {
      date: '2014-08-15',
      value: '97.17',
    },
    {
      date: '2014-08-08',
      value: '97.50',
    },
    {
      date: '2014-08-01',
      value: '102.19',
    },
    {
      date: '2014-07-25',
      value: '104.35',
    },
    {
      date: '2014-07-18',
      value: '102.37',
    },
    {
      date: '2014-07-11',
      value: '103.25',
    },
    {
      date: '2014-07-04',
      value: '105.52',
    },
    {
      date: '2014-06-27',
      value: '106.69',
    },
    {
      date: '2014-06-20',
      value: '107.23',
    },
    {
      date: '2014-06-13',
      value: '105.97',
    },
    {
      date: '2014-06-06',
      value: '103.23',
    },
    {
      date: '2014-05-30',
      value: '103.95',
    },
    {
      date: '2014-05-23',
      value: '103.82',
    },
    {
      date: '2014-05-16',
      value: '101.92',
    },
    {
      date: '2014-05-09',
      value: '100.29',
    },
    {
      date: '2014-05-02',
      value: '100.51',
    },
    {
      date: '2014-04-25',
      value: '102.11',
    },
    {
      date: '2014-04-18',
      value: '103.95',
    },
    {
      date: '2014-04-11',
      value: '102.72',
    },
    {
      date: '2014-04-04',
      value: '100.46',
    },
    {
      date: '2014-03-28',
      value: '100.66',
    },
    {
      date: '2014-03-21',
      value: '99.77',
    },
    {
      date: '2014-03-14',
      value: '99.55',
    },
    {
      date: '2014-03-07',
      value: '103.07',
    },
    {
      date: '2014-02-28',
      value: '102.77',
    },
    {
      date: '2014-02-21',
      value: '102.93',
    },
    {
      date: '2014-02-14',
      value: '100.21',
    },
    {
      date: '2014-02-07',
      value: '97.78',
    },
    {
      date: '2014-01-31',
      value: '97.29',
    },
    {
      date: '2014-01-24',
      value: '96.19',
    },
    {
      date: '2014-01-17',
      value: '92.98',
    },
    {
      date: '2014-01-10',
      value: '92.42',
    },
    {
      date: '2014-01-03',
      value: '96.47',
    },
    {
      date: '2013-12-27',
      value: '99.15',
    },
    {
      date: '2013-12-20',
      value: '97.85',
    },
    {
      date: '2013-12-13',
      value: '97.23',
    },
    {
      date: '2013-12-06',
      value: '96.21',
    },
    {
      date: '2013-11-29',
      value: '92.97',
    },
    {
      date: '2013-11-22',
      value: '93.92',
    },
    {
      date: '2013-11-15',
      value: '93.94',
    },
    {
      date: '2013-11-08',
      value: '94.31',
    },
    {
      date: '2013-11-01',
      value: '96.94',
    },
    {
      date: '2013-10-25',
      value: '97.57',
    },
    {
      date: '2013-10-18',
      value: '101.51',
    },
    {
      date: '2013-10-11',
      value: '102.70',
    },
    {
      date: '2013-10-04',
      value: '103.14',
    },
    {
      date: '2013-09-27',
      value: '103.10',
    },
    {
      date: '2013-09-20',
      value: '106.22',
    },
    {
      date: '2013-09-13',
      value: '108.36',
    },
    {
      date: '2013-09-06',
      value: '108.77',
    },
    {
      date: '2013-08-30',
      value: '108.33',
    },
    {
      date: '2013-08-23',
      value: '105.48',
    },
    {
      date: '2013-08-16',
      value: '106.97',
    },
    {
      date: '2013-08-09',
      value: '105.17',
    },
    {
      date: '2013-08-02',
      value: '105.54',
    },
    {
      date: '2013-07-26',
      value: '105.88',
    },
    {
      date: '2013-07-19',
      value: '106.88',
    },
    {
      date: '2013-07-12',
      value: '104.70',
    },
    {
      date: '2013-07-05',
      value: '100.65',
    },
    {
      date: '2013-06-28',
      value: '95.83',
    },
    {
      date: '2013-06-21',
      value: '96.65',
    },
    {
      date: '2013-06-14',
      value: '96.36',
    },
    {
      date: '2013-06-07',
      value: '94.25',
    },
    {
      date: '2013-05-31',
      value: '93.32',
    },
    {
      date: '2013-05-24',
      value: '94.76',
    },
    {
      date: '2013-05-17',
      value: '94.65',
    },
    {
      date: '2013-05-10',
      value: '95.84',
    },
    {
      date: '2013-05-03',
      value: '93.40',
    },
    {
      date: '2013-04-26',
      value: '91.00',
    },
    {
      date: '2013-04-19',
      value: '88.00',
    },
    {
      date: '2013-04-12',
      value: '93.36',
    },
    {
      date: '2013-04-05',
      value: '95.07',
    },
    {
      date: '2013-03-29',
      value: '96.08',
    },
    {
      date: '2013-03-22',
      value: '93.05',
    },
    {
      date: '2013-03-15',
      value: '92.70',
    },
    {
      date: '2013-03-08',
      value: '91.00',
    },
    {
      date: '2013-03-01',
      value: '92.19',
    },
    {
      date: '2013-02-22',
      value: '94.38',
    },
    {
      date: '2013-02-15',
      value: '96.95',
    },
    {
      date: '2013-02-08',
      value: '96.18',
    },
    {
      date: '2013-02-01',
      value: '97.33',
    },
    {
      date: '2013-01-25',
      value: '95.41',
    },
    {
      date: '2013-01-18',
      value: '94.58',
    },
    {
      date: '2013-01-11',
      value: '93.38',
    },
    {
      date: '2013-01-04',
      value: '92.77',
    },
    {
      date: '2012-12-28',
      value: '90.14',
    },
    {
      date: '2012-12-21',
      value: '88.24',
    },
    {
      date: '2012-12-14',
      value: '85.71',
    },
    {
      date: '2012-12-07',
      value: '87.00',
    },
    {
      date: '2012-11-30',
      value: '87.27',
    },
    {
      date: '2012-11-23',
      value: '87.40',
    },
    {
      date: '2012-11-16',
      value: '85.87',
    },
    {
      date: '2012-11-09',
      value: '85.98',
    },
    {
      date: '2012-11-02',
      value: '85.87',
    },
    {
      date: '2012-10-26',
      value: '86.35',
    },
    {
      date: '2012-10-19',
      value: '91.59',
    },
    {
      date: '2012-10-12',
      value: '91.42',
    },
    {
      date: '2012-10-05',
      value: '90.81',
    },
    {
      date: '2012-09-28',
      value: '91.35',
    },
    {
      date: '2012-09-21',
      value: '93.70',
    },
    {
      date: '2012-09-14',
      value: '97.56',
    },
    {
      date: '2012-09-07',
      value: '95.68',
    },
    {
      date: '2012-08-31',
      value: '95.68',
    },
    {
      date: '2012-08-24',
      value: '96.22',
    },
    {
      date: '2012-08-17',
      value: '94.43',
    },
    {
      date: '2012-08-10',
      value: '93.14',
    },
    {
      date: '2012-08-03',
      value: '89.10',
    },
    {
      date: '2012-07-27',
      value: '88.88',
    },
    {
      date: '2012-07-20',
      value: '90.34',
    },
    {
      date: '2012-07-13',
      value: '85.78',
    },
    {
      date: '2012-07-06',
      value: '85.74',
    },
    {
      date: '2012-06-29',
      value: '80.23',
    },
    {
      date: '2012-06-22',
      value: '81.11',
    },
    {
      date: '2012-06-15',
      value: '83.27',
    },
    {
      date: '2012-06-08',
      value: '84.43',
    },
    {
      date: '2012-06-01',
      value: '87.06',
    },
    {
      date: '2012-05-25',
      value: '90.88',
    },
    {
      date: '2012-05-18',
      value: '93.11',
    },
    {
      date: '2012-05-11',
      value: '96.98',
    },
    {
      date: '2012-05-04',
      value: '103.47',
    },
    {
      date: '2012-04-27',
      value: '103.78',
    },
    {
      date: '2012-04-20',
      value: '103.15',
    },
    {
      date: '2012-04-13',
      value: '102.55',
    },
    {
      date: '2012-04-06',
      value: '103.52',
    },
    {
      date: '2012-03-30',
      value: '105.12',
    },
    {
      date: '2012-03-23',
      value: '106.41',
    },
    {
      date: '2012-03-16',
      value: '106.15',
    },
    {
      date: '2012-03-09',
      value: '106.32',
    },
    {
      date: '2012-03-02',
      value: '107.52',
    },
    {
      date: '2012-02-24',
      value: '107.18',
    },
    {
      date: '2012-02-17',
      value: '101.73',
    },
    {
      date: '2012-02-10',
      value: '98.56',
    },
    {
      date: '2012-02-03',
      value: '97.80',
    },
    {
      date: '2012-01-27',
      value: '99.35',
    },
    {
      date: '2012-01-20',
      value: '99.95',
    },
    {
      date: '2012-01-13',
      value: '100.43',
    },
    {
      date: '2012-01-06',
      value: '102.39',
    },
    {
      date: '2011-12-30',
      value: '99.81',
    },
    {
      date: '2011-12-23',
      value: '97.74',
    },
    {
      date: '2011-12-16',
      value: '96.06',
    },
    {
      date: '2011-12-09',
      value: '100.08',
    },
    {
      date: '2011-12-02',
      value: '99.91',
    },
    {
      date: '2011-11-25',
      value: '96.89',
    },
    {
      date: '2011-11-18',
      value: '99.32',
    },
    {
      date: '2011-11-11',
      value: '96.97',
    },
    {
      date: '2011-11-04',
      value: '93.24',
    },
    {
      date: '2011-10-28',
      value: '92.32',
    },
    {
      date: '2011-10-21',
      value: '86.82',
    },
    {
      date: '2011-10-14',
      value: '85.35',
    },
    {
      date: '2011-10-07',
      value: '79.43',
    },
    {
      date: '2011-09-30',
      value: '81.18',
    },
    {
      date: '2011-09-23',
      value: '83.65',
    },
    {
      date: '2011-09-16',
      value: '88.93',
    },
    {
      date: '2011-09-09',
      value: '87.91',
    },
    {
      date: '2011-09-02',
      value: '88.07',
    },
    {
      date: '2011-08-26',
      value: '85.06',
    },
    {
      date: '2011-08-19',
      value: '85.36',
    },
    {
      date: '2011-08-12',
      value: '82.86',
    },
    {
      date: '2011-08-05',
      value: '90.85',
    },
    {
      date: '2011-07-29',
      value: '97.83',
    },
    {
      date: '2011-07-22',
      value: '98.01',
    },
    {
      date: '2011-07-15',
      value: '96.72',
    },
    {
      date: '2011-07-08',
      value: '97.12',
    },
    {
      date: '2011-07-01',
      value: '93.70',
    },
    {
      date: '2011-06-24',
      value: '92.70',
    },
    {
      date: '2011-06-17',
      value: '95.87',
    },
    {
      date: '2011-06-10',
      value: '100.05',
    },
    {
      date: '2011-06-03',
      value: '100.92',
    },
    {
      date: '2011-05-27',
      value: '99.55',
    },
    {
      date: '2011-05-20',
      value: '97.99',
    },
    {
      date: '2011-05-13',
      value: '99.87',
    },
    {
      date: '2011-05-06',
      value: '105.84',
    },
    {
      date: '2011-04-29',
      value: '112.30',
    },
    {
      date: '2011-04-22',
      value: '109.11',
    },
    {
      date: '2011-04-15',
      value: '107.75',
    },
    {
      date: '2011-04-08',
      value: '109.29',
    },
    {
      date: '2011-04-01',
      value: '105.08',
    },
    {
      date: '2011-03-25',
      value: '104.41',
    },
    {
      date: '2011-03-18',
      value: '99.79',
    },
    {
      date: '2011-03-11',
      value: '103.74',
    },
    {
      date: '2011-03-04',
      value: '101.05',
    },
    {
      date: '2011-02-25',
      value: '95.26',
    },
    {
      date: '2011-02-18',
      value: '84.13',
    },
    {
      date: '2011-02-11',
      value: '85.51',
    },
    {
      date: '2011-02-04',
      value: '89.52',
    },
    {
      date: '2011-01-28',
      value: '86.11',
    },
    {
      date: '2011-01-21',
      value: '89.75',
    },
    {
      date: '2011-01-14',
      value: '91.02',
    },
    {
      date: '2011-01-07',
      value: '89.54',
    },
    {
      date: '2010-12-31',
      value: '90.97',
    },
    {
      date: '2010-12-24',
      value: '89.66',
    },
    {
      date: '2010-12-17',
      value: '88.27',
    },
    {
      date: '2010-12-10',
      value: '88.50',
    },
    {
      date: '2010-12-03',
      value: '86.75',
    },
    {
      date: '2010-11-26',
      value: '82.28',
    },
    {
      date: '2010-11-19',
      value: '82.23',
    },
    {
      date: '2010-11-12',
      value: '86.91',
    },
    {
      date: '2010-11-05',
      value: '84.93',
    },
    {
      date: '2010-10-29',
      value: '82.03',
    },
    {
      date: '2010-10-22',
      value: '81.15',
    },
    {
      date: '2010-10-15',
      value: '82.16',
    },
    {
      date: '2010-10-08',
      value: '82.29',
    },
    {
      date: '2010-10-01',
      value: '78.41',
    },
    {
      date: '2010-09-24',
      value: '73.76',
    },
    {
      date: '2010-09-17',
      value: '75.62',
    },
    {
      date: '2010-09-10',
      value: '74.82',
    },
    {
      date: '2010-09-03',
      value: '74.02',
    },
    {
      date: '2010-08-27',
      value: '72.91',
    },
    {
      date: '2010-08-20',
      value: '74.84',
    },
    {
      date: '2010-08-13',
      value: '78.17',
    },
    {
      date: '2010-08-06',
      value: '81.79',
    },
    {
      date: '2010-07-30',
      value: '78.12',
    },
    {
      date: '2010-07-23',
      value: '77.56',
    },
    {
      date: '2010-07-16',
      value: '76.35',
    },
    {
      date: '2010-07-09',
      value: '74.39',
    },
    {
      date: '2010-07-02',
      value: '74.96',
    },
    {
      date: '2010-06-25',
      value: '77.06',
    },
    {
      date: '2010-06-18',
      value: '76.70',
    },
    {
      date: '2010-06-11',
      value: '73.44',
    },
    {
      date: '2010-06-04',
      value: '72.91',
    },
    {
      date: '2010-05-28',
      value: '70.62',
    },
    {
      date: '2010-05-21',
      value: '69.14',
    },
    {
      date: '2010-05-14',
      value: '74.98',
    },
    {
      date: '2010-05-07',
      value: '80.24',
    },
    {
      date: '2010-04-30',
      value: '84.22',
    },
    {
      date: '2010-04-23',
      value: '82.90',
    },
    {
      date: '2010-04-16',
      value: '84.34',
    },
    {
      date: '2010-04-09',
      value: '85.66',
    },
    {
      date: '2010-04-02',
      value: '83.01',
    },
    {
      date: '2010-03-26',
      value: '80.65',
    },
    {
      date: '2010-03-19',
      value: '81.44',
    },
    {
      date: '2010-03-12',
      value: '81.76',
    },
    {
      date: '2010-03-05',
      value: '80.19',
    },
    {
      date: '2010-02-26',
      value: '79.22',
    },
    {
      date: '2010-02-19',
      value: '78.25',
    },
    {
      date: '2010-02-12',
      value: '73.88',
    },
    {
      date: '2010-02-05',
      value: '74.57',
    },
    {
      date: '2010-01-29',
      value: '73.94',
    },
    {
      date: '2010-01-22',
      value: '76.62',
    },
    {
      date: '2010-01-15',
      value: '80.06',
    },
    {
      date: '2010-01-08',
      value: '82.34',
    },
    {
      date: '2010-01-01',
      value: '79.07',
    },
    {
      date: '2009-12-25',
      value: '74.76',
    },
    {
      date: '2009-12-18',
      value: '71.72',
    },
    {
      date: '2009-12-11',
      value: '71.51',
    },
    {
      date: '2009-12-04',
      value: '76.81',
    },
    {
      date: '2009-11-27',
      value: '76.14',
    },
    {
      date: '2009-11-20',
      value: '78.37',
    },
    {
      date: '2009-11-13',
      value: '78.24',
    },
    {
      date: '2009-11-06',
      value: '79.00',
    },
    {
      date: '2009-10-30',
      value: '78.47',
    },
    {
      date: '2009-10-23',
      value: '80.06',
    },
    {
      date: '2009-10-16',
      value: '75.73',
    },
    {
      date: '2009-10-09',
      value: '70.80',
    },
    {
      date: '2009-10-02',
      value: '68.84',
    },
    {
      date: '2009-09-25',
      value: '68.33',
    },
    {
      date: '2009-09-18',
      value: '71.32',
    },
    {
      date: '2009-09-11',
      value: '70.91',
    },
    {
      date: '2009-09-04',
      value: '68.39',
    },
    {
      date: '2009-08-28',
      value: '72.37',
    },
    {
      date: '2009-08-21',
      value: '70.80',
    },
    {
      date: '2009-08-14',
      value: '69.64',
    },
    {
      date: '2009-08-07',
      value: '71.58',
    },
    {
      date: '2009-07-31',
      value: '67.03',
    },
    {
      date: '2009-07-24',
      value: '65.28',
    },
    {
      date: '2009-07-17',
      value: '61.29',
    },
    {
      date: '2009-07-10',
      value: '61.48',
    },
    {
      date: '2009-07-03',
      value: '69.32',
    },
    {
      date: '2009-06-26',
      value: '68.58',
    },
    {
      date: '2009-06-19',
      value: '70.62',
    },
    {
      date: '2009-06-12',
      value: '70.85',
    },
    {
      date: '2009-06-05',
      value: '68.11',
    },
    {
      date: '2009-05-29',
      value: '64.32',
    },
    {
      date: '2009-05-22',
      value: '60.32',
    },
    {
      date: '2009-05-15',
      value: '57.94',
    },
    {
      date: '2009-05-08',
      value: '55.96',
    },
    {
      date: '2009-05-01',
      value: '50.20',
    },
    {
      date: '2009-04-24',
      value: '47.80',
    },
    {
      date: '2009-04-17',
      value: '49.86',
    },
    {
      date: '2009-04-10',
      value: '50.46',
    },
    {
      date: '2009-04-03',
      value: '50.34',
    },
    {
      date: '2009-03-27',
      value: '52.99',
    },
    {
      date: '2009-03-20',
      value: '49.49',
    },
    {
      date: '2009-03-13',
      value: '45.66',
    },
    {
      date: '2009-03-06',
      value: '43.18',
    },
    {
      date: '2009-02-27',
      value: '41.10',
    },
    {
      date: '2009-02-20',
      value: '37.15',
    },
    {
      date: '2009-02-13',
      value: '36.94',
    },
    {
      date: '2009-02-06',
      value: '40.78',
    },
    {
      date: '2009-01-30',
      value: '42.70',
    },
    {
      date: '2009-01-23',
      value: '42.15',
    },
    {
      date: '2009-01-16',
      value: '36.73',
    },
    {
      date: '2009-01-09',
      value: '44.46',
    },
    {
      date: '2009-01-02',
      value: '42.40',
    },
    {
      date: '2008-12-26',
      value: '32.98',
    },
    {
      date: '2008-12-19',
      value: '39.70',
    },
    {
      date: '2008-12-12',
      value: '44.57',
    },
    {
      date: '2008-12-05',
      value: '45.60',
    },
    {
      date: '2008-11-28',
      value: '53.27',
    },
    {
      date: '2008-11-21',
      value: '52.26',
    },
    {
      date: '2008-11-14',
      value: '58.60',
    },
    {
      date: '2008-11-07',
      value: '64.31',
    },
    {
      date: '2008-10-31',
      value: '65.21',
    },
    {
      date: '2008-10-24',
      value: '68.56',
    },
    {
      date: '2008-10-17',
      value: '75.19',
    },
    {
      date: '2008-10-10',
      value: '86.24',
    },
    {
      date: '2008-10-03',
      value: '96.59',
    },
    {
      date: '2008-09-26',
      value: '111.12',
    },
    {
      date: '2008-09-19',
      value: '97.19',
    },
    {
      date: '2008-09-12',
      value: '102.88',
    },
    {
      date: '2008-09-05',
      value: '108.37',
    },
    {
      date: '2008-08-29',
      value: '116.09',
    },
    {
      date: '2008-08-22',
      value: '115.70',
    },
    {
      date: '2008-08-15',
      value: '114.40',
    },
    {
      date: '2008-08-08',
      value: '118.80',
    },
    {
      date: '2008-08-01',
      value: '124.57',
    },
    {
      date: '2008-07-25',
      value: '125.92',
    },
    {
      date: '2008-07-18',
      value: '135.37',
    },
    {
      date: '2008-07-11',
      value: '139.95',
    },
    {
      date: '2008-07-04',
      value: '142.52',
    },
    {
      date: '2008-06-27',
      value: '137.00',
    },
    {
      date: '2008-06-20',
      value: '134.34',
    },
    {
      date: '2008-06-13',
      value: '134.80',
    },
    {
      date: '2008-06-06',
      value: '128.16',
    },
    {
      date: '2008-05-30',
      value: '128.47',
    },
    {
      date: '2008-05-23',
      value: '130.14',
    },
    {
      date: '2008-05-16',
      value: '124.96',
    },
    {
      date: '2008-05-09',
      value: '123.01',
    },
    {
      date: '2008-05-02',
      value: '115.42',
    },
    {
      date: '2008-04-25',
      value: '118.53',
    },
    {
      date: '2008-04-18',
      value: '114.33',
    },
    {
      date: '2008-04-11',
      value: '109.71',
    },
    {
      date: '2008-04-04',
      value: '103.46',
    },
    {
      date: '2008-03-28',
      value: '104.49',
    },
    {
      date: '2008-03-21',
      value: '105.28',
    },
    {
      date: '2008-03-14',
      value: '109.35',
    },
    {
      date: '2008-03-07',
      value: '103.44',
    },
    {
      date: '2008-02-29',
      value: '100.84',
    },
    {
      date: '2008-02-22',
      value: '99.61',
    },
    {
      date: '2008-02-15',
      value: '94.13',
    },
    {
      date: '2008-02-08',
      value: '89.08',
    },
    {
      date: '2008-02-01',
      value: '91.14',
    },
    {
      date: '2008-01-25',
      value: '89.41',
    },
    {
      date: '2008-01-18',
      value: '91.51',
    },
    {
      date: '2008-01-11',
      value: '94.76',
    },
    {
      date: '2008-01-04',
      value: '98.17',
    },
    {
      date: '2007-12-28',
      value: '95.64',
    },
    {
      date: '2007-12-21',
      value: '91.16',
    },
    {
      date: '2007-12-14',
      value: '91.18',
    },
    {
      date: '2007-12-07',
      value: '88.71',
    },
    {
      date: '2007-11-30',
      value: '92.47',
    },
    {
      date: '2007-11-23',
      value: '97.93',
    },
    {
      date: '2007-11-16',
      value: '93.56',
    },
    {
      date: '2007-11-09',
      value: '95.81',
    },
    {
      date: '2007-11-02',
      value: '93.46',
    },
    {
      date: '2007-10-26',
      value: '89.23',
    },
    {
      date: '2007-10-19',
      value: '87.80',
    },
    {
      date: '2007-10-12',
      value: '81.46',
    },
    {
      date: '2007-10-05',
      value: '80.59',
    },
    {
      date: '2007-09-28',
      value: '81.70',
    },
    {
      date: '2007-09-21',
      value: '82.26',
    },
    {
      date: '2007-09-14',
      value: '78.95',
    },
    {
      date: '2007-09-07',
      value: '75.96',
    },
    {
      date: '2007-08-31',
      value: '72.93',
    },
    {
      date: '2007-08-24',
      value: '70.19',
    },
    {
      date: '2007-08-17',
      value: '72.05',
    },
    {
      date: '2007-08-10',
      value: '71.92',
    },
    {
      date: '2007-08-03',
      value: '76.75',
    },
    {
      date: '2007-07-27',
      value: '75.15',
    },
    {
      date: '2007-07-20',
      value: '74.92',
    },
    {
      date: '2007-07-13',
      value: '72.79',
    },
    {
      date: '2007-07-06',
      value: '71.78',
    },
    {
      date: '2007-06-29',
      value: '69.13',
    },
    {
      date: '2007-06-22',
      value: '68.78',
    },
    {
      date: '2007-06-15',
      value: '66.62',
    },
    {
      date: '2007-06-08',
      value: '65.90',
    },
    {
      date: '2007-06-01',
      value: '63.94',
    },
    {
      date: '2007-05-25',
      value: '64.89',
    },
    {
      date: '2007-05-18',
      value: '63.61',
    },
    {
      date: '2007-05-11',
      value: '61.90',
    },
    {
      date: '2007-05-04',
      value: '63.82',
    },
    {
      date: '2007-04-27',
      value: '65.26',
    },
    {
      date: '2007-04-20',
      value: '63.06',
    },
    {
      date: '2007-04-13',
      value: '62.58',
    },
    {
      date: '2007-04-06',
      value: '64.82',
    },
    {
      date: '2007-03-30',
      value: '64.18',
    },
    {
      date: '2007-03-23',
      value: '58.26',
    },
    {
      date: '2007-03-16',
      value: '57.94',
    },
    {
      date: '2007-03-09',
      value: '60.85',
    },
    {
      date: '2007-03-02',
      value: '61.64',
    },
    {
      date: '2007-02-23',
      value: '59.57',
    },
    {
      date: '2007-02-16',
      value: '58.41',
    },
    {
      date: '2007-02-09',
      value: '58.99',
    },
    {
      date: '2007-02-02',
      value: '57.11',
    },
    {
      date: '2007-01-26',
      value: '53.57',
    },
    {
      date: '2007-01-19',
      value: '51.51',
    },
    {
      date: '2007-01-12',
      value: '54.11',
    },
    {
      date: '2007-01-05',
      value: '57.76',
    },
    {
      date: '2006-12-29',
      value: '60.66',
    },
    {
      date: '2006-12-22',
      value: '62.40',
    },
    {
      date: '2006-12-15',
      value: '61.91',
    },
    {
      date: '2006-12-08',
      value: '62.32',
    },
    {
      date: '2006-12-01',
      value: '62.02',
    },
    {
      date: '2006-11-24',
      value: '57.24',
    },
    {
      date: '2006-11-17',
      value: '57.56',
    },
    {
      date: '2006-11-10',
      value: '59.96',
    },
    {
      date: '2006-11-03',
      value: '58.55',
    },
    {
      date: '2006-10-27',
      value: '58.88',
    },
    {
      date: '2006-10-20',
      value: '58.48',
    },
    {
      date: '2006-10-13',
      value: '58.58',
    },
    {
      date: '2006-10-06',
      value: '59.77',
    },
    {
      date: '2006-09-29',
      value: '61.94',
    },
    {
      date: '2006-09-22',
      value: '61.40',
    },
    {
      date: '2006-09-15',
      value: '63.98',
    },
    {
      date: '2006-09-08',
      value: '67.53',
    },
    {
      date: '2006-09-01',
      value: '70.01',
    },
    {
      date: '2006-08-25',
      value: '72.12',
    },
    {
      date: '2006-08-18',
      value: '71.79',
    },
    {
      date: '2006-08-11',
      value: '75.63',
    },
    {
      date: '2006-08-04',
      value: '75.20',
    },
    {
      date: '2006-07-28',
      value: '73.87',
    },
    {
      date: '2006-07-21',
      value: '73.98',
    },
    {
      date: '2006-07-14',
      value: '75.21',
    },
    {
      date: '2006-07-07',
      value: '74.65',
    },
    {
      date: '2006-06-30',
      value: '72.65',
    },
    {
      date: '2006-06-23',
      value: '69.94',
    },
    {
      date: '2006-06-16',
      value: '69.48',
    },
    {
      date: '2006-06-09',
      value: '71.54',
    },
    {
      date: '2006-06-02',
      value: '71.53',
    },
    {
      date: '2006-05-26',
      value: '70.35',
    },
    {
      date: '2006-05-19',
      value: '69.07',
    },
    {
      date: '2006-05-12',
      value: '71.50',
    },
    {
      date: '2006-05-05',
      value: '72.14',
    },
    {
      date: '2006-04-28',
      value: '70.38',
    },
    {
      date: '2006-04-21',
      value: '71.87',
    },
    {
      date: '2006-04-14',
      value: '68.85',
    },
    {
      date: '2006-04-07',
      value: '66.56',
    },
    {
      date: '2006-03-31',
      value: '65.67',
    },
    {
      date: '2006-03-24',
      value: '61.36',
    },
    {
      date: '2006-03-17',
      value: '62.64',
    },
    {
      date: '2006-03-10',
      value: '60.89',
    },
    {
      date: '2006-03-03',
      value: '62.27',
    },
    {
      date: '2006-02-24',
      value: '59.93',
    },
    {
      date: '2006-02-17',
      value: '59.37',
    },
    {
      date: '2006-02-10',
      value: '63.06',
    },
    {
      date: '2006-02-03',
      value: '66.59',
    },
    {
      date: '2006-01-27',
      value: '66.82',
    },
    {
      date: '2006-01-20',
      value: '66.79',
    },
    {
      date: '2006-01-13',
      value: '63.74',
    },
    {
      date: '2006-01-06',
      value: '63.39',
    },
    {
      date: '2005-12-30',
      value: '59.82',
    },
    {
      date: '2005-12-23',
      value: '57.97',
    },
    {
      date: '2005-12-16',
      value: '60.32',
    },
    {
      date: '2005-12-09',
      value: '59.83',
    },
    {
      date: '2005-12-02',
      value: '57.78',
    },
    {
      date: '2005-11-25',
      value: '58.13',
    },
    {
      date: '2005-11-18',
      value: '57.00',
    },
    {
      date: '2005-11-11',
      value: '58.80',
    },
    {
      date: '2005-11-04',
      value: '60.34',
    },
    {
      date: '2005-10-28',
      value: '61.33',
    },
    {
      date: '2005-10-21',
      value: '62.28',
    },
    {
      date: '2005-10-14',
      value: '62.87',
    },
    {
      date: '2005-10-07',
      value: '63.06',
    },
    {
      date: '2005-09-30',
      value: '66.06',
    },
    {
      date: '2005-09-23',
      value: '66.43',
    },
    {
      date: '2005-09-16',
      value: '63.84',
    },
    {
      date: '2005-09-09',
      value: '64.81',
    },
    {
      date: '2005-09-02',
      value: '68.47',
    },
    {
      date: '2005-08-26',
      value: '66.34',
    },
    {
      date: '2005-08-19',
      value: '64.92',
    },
    {
      date: '2005-08-12',
      value: '64.85',
    },
    {
      date: '2005-08-05',
      value: '61.64',
    },
    {
      date: '2005-07-29',
      value: '59.39',
    },
    {
      date: '2005-07-22',
      value: '57.30',
    },
    {
      date: '2005-07-15',
      value: '59.18',
    },
    {
      date: '2005-07-08',
      value: '60.36',
    },
    {
      date: '2005-07-01',
      value: '58.21',
    },
    {
      date: '2005-06-24',
      value: '59.04',
    },
    {
      date: '2005-06-17',
      value: '56.18',
    },
    {
      date: '2005-06-10',
      value: '53.74',
    },
    {
      date: '2005-06-03',
      value: '53.76',
    },
    {
      date: '2005-05-27',
      value: '50.15',
    },
    {
      date: '2005-05-20',
      value: '47.77',
    },
    {
      date: '2005-05-13',
      value: '50.33',
    },
    {
      date: '2005-05-06',
      value: '50.64',
    },
    {
      date: '2005-04-29',
      value: '52.00',
    },
    {
      date: '2005-04-22',
      value: '52.39',
    },
    {
      date: '2005-04-15',
      value: '51.44',
    },
    {
      date: '2005-04-08',
      value: '55.24',
    },
    {
      date: '2005-04-01',
      value: '54.97',
    },
    {
      date: '2005-03-25',
      value: '52.95',
    },
    {
      date: '2005-03-18',
      value: '55.93',
    },
    {
      date: '2005-03-11',
      value: '54.22',
    },
    {
      date: '2005-03-04',
      value: '52.74',
    },
    {
      date: '2005-02-25',
      value: '51.75',
    },
    {
      date: '2005-02-18',
      value: '47.82',
    },
    {
      date: '2005-02-11',
      value: '46.08',
    },
    {
      date: '2005-02-04',
      value: '46.97',
    },
    {
      date: '2005-01-28',
      value: '48.56',
    },
    {
      date: '2005-01-21',
      value: '47.85',
    },
    {
      date: '2005-01-14',
      value: '46.79',
    },
    {
      date: '2005-01-07',
      value: '44.07',
    },
    {
      date: '2004-12-31',
      value: '42.52',
    },
    {
      date: '2004-12-24',
      value: '44.39',
    },
    {
      date: '2004-12-17',
      value: '43.50',
    },
    {
      date: '2004-12-10',
      value: '41.91',
    },
    {
      date: '2004-12-03',
      value: '46.06',
    },
    {
      date: '2004-11-26',
      value: '48.79',
    },
    {
      date: '2004-11-19',
      value: '47.02',
    },
    {
      date: '2004-11-12',
      value: '48.00',
    },
    {
      date: '2004-11-05',
      value: '49.81',
    },
    {
      date: '2004-10-29',
      value: '53.43',
    },
    {
      date: '2004-10-22',
      value: '54.43',
    },
    {
      date: '2004-10-15',
      value: '54.12',
    },
    {
      date: '2004-10-08',
      value: '51.77',
    },
    {
      date: '2004-10-01',
      value: '49.71',
    },
    {
      date: '2004-09-24',
      value: '47.82',
    },
    {
      date: '2004-09-17',
      value: '44.39',
    },
    {
      date: '2004-09-10',
      value: '43.33',
    },
    {
      date: '2004-09-03',
      value: '43.28',
    },
    {
      date: '2004-08-27',
      value: '44.34',
    },
    {
      date: '2004-08-20',
      value: '47.28',
    },
    {
      date: '2004-08-13',
      value: '45.24',
    },
    {
      date: '2004-08-06',
      value: '43.81',
    },
    {
      date: '2004-07-30',
      value: '42.50',
    },
    {
      date: '2004-07-23',
      value: '41.27',
    },
    {
      date: '2004-07-16',
      value: '40.33',
    },
    {
      date: '2004-07-09',
      value: '39.73',
    },
    {
      date: '2004-07-02',
      value: '37.14',
    },
    {
      date: '2004-06-25',
      value: '37.70',
    },
    {
      date: '2004-06-18',
      value: '37.86',
    },
    {
      date: '2004-06-11',
      value: '37.99',
    },
    {
      date: '2004-06-04',
      value: '40.01',
    },
    {
      date: '2004-05-28',
      value: '40.65',
    },
    {
      date: '2004-05-21',
      value: '40.84',
    },
    {
      date: '2004-05-14',
      value: '40.37',
    },
    {
      date: '2004-05-07',
      value: '39.24',
    },
    {
      date: '2004-04-30',
      value: '37.31',
    },
    {
      date: '2004-04-23',
      value: '37.32',
    },
    {
      date: '2004-04-16',
      value: '37.39',
    },
    {
      date: '2004-04-09',
      value: '35.70',
    },
    {
      date: '2004-04-02',
      value: '35.23',
    },
    {
      date: '2004-03-26',
      value: '36.65',
    },
    {
      date: '2004-03-19',
      value: '37.78',
    },
    {
      date: '2004-03-12',
      value: '36.44',
    },
    {
      date: '2004-03-05',
      value: '36.67',
    },
    {
      date: '2004-02-27',
      value: '36.08',
    },
    {
      date: '2004-02-20',
      value: '35.54',
    },
    {
      date: '2004-02-13',
      value: '33.88',
    },
    {
      date: '2004-02-06',
      value: '33.41',
    },
    {
      date: '2004-01-30',
      value: '33.61',
    },
    {
      date: '2004-01-23',
      value: '35.45',
    },
    {
      date: '2004-01-16',
      value: '34.51',
    },
    {
      date: '2004-01-09',
      value: '33.89',
    },
    {
      date: '2004-01-02',
      value: '32.68',
    },
    {
      date: '2003-12-26',
      value: '32.24',
    },
    {
      date: '2003-12-19',
      value: '33.20',
    },
    {
      date: '2003-12-12',
      value: '32.16',
    },
    {
      date: '2003-12-05',
      value: '30.63',
    },
    {
      date: '2003-11-28',
      value: '30.11',
    },
    {
      date: '2003-11-21',
      value: '32.58',
    },
    {
      date: '2003-11-14',
      value: '31.56',
    },
    {
      date: '2003-11-07',
      value: '29.79',
    },
    {
      date: '2003-10-31',
      value: '29.28',
    },
    {
      date: '2003-10-24',
      value: '30.17',
    },
    {
      date: '2003-10-17',
      value: '31.49',
    },
    {
      date: '2003-10-10',
      value: '30.69',
    },
    {
      date: '2003-10-03',
      value: '29.43',
    },
    {
      date: '2003-09-26',
      value: '27.73',
    },
    {
      date: '2003-09-19',
      value: '27.39',
    },
    {
      date: '2003-09-12',
      value: '28.92',
    },
    {
      date: '2003-09-05',
      value: '29.20',
    },
    {
      date: '2003-08-29',
      value: '31.56',
    },
    {
      date: '2003-08-22',
      value: '31.19',
    },
    {
      date: '2003-08-15',
      value: '31.31',
    },
    {
      date: '2003-08-08',
      value: '32.11',
    },
    {
      date: '2003-08-01',
      value: '30.73',
    },
    {
      date: '2003-07-25',
      value: '30.61',
    },
    {
      date: '2003-07-18',
      value: '31.48',
    },
    {
      date: '2003-07-11',
      value: '30.73',
    },
    {
      date: '2003-07-04',
      value: '30.31',
    },
    {
      date: '2003-06-27',
      value: '30.01',
    },
    {
      date: '2003-06-20',
      value: '30.60',
    },
    {
      date: '2003-06-13',
      value: '31.46',
    },
    {
      date: '2003-06-06',
      value: '30.68',
    },
    {
      date: '2003-05-30',
      value: '29.10',
    },
    {
      date: '2003-05-23',
      value: '29.29',
    },
    {
      date: '2003-05-16',
      value: '28.54',
    },
    {
      date: '2003-05-09',
      value: '26.58',
    },
    {
      date: '2003-05-02',
      value: '25.69',
    },
    {
      date: '2003-04-25',
      value: '28.43',
    },
    {
      date: '2003-04-18',
      value: '29.28',
    },
    {
      date: '2003-04-11',
      value: '28.03',
    },
    {
      date: '2003-04-04',
      value: '29.33',
    },
    {
      date: '2003-03-28',
      value: '30.43',
    },
    {
      date: '2003-03-21',
      value: '30.46',
    },
    {
      date: '2003-03-14',
      value: '36.66',
    },
    {
      date: '2003-03-07',
      value: '36.98',
    },
    {
      date: '2003-02-28',
      value: '36.98',
    },
    {
      date: '2003-02-21',
      value: '36.78',
    },
    {
      date: '2003-02-14',
      value: '35.79',
    },
    {
      date: '2003-02-07',
      value: '33.95',
    },
    {
      date: '2003-01-31',
      value: '33.19',
    },
    {
      date: '2003-01-24',
      value: '34.46',
    },
    {
      date: '2003-01-17',
      value: '33.04',
    },
    {
      date: '2003-01-10',
      value: '31.54',
    },
    {
      date: '2003-01-03',
      value: '31.96',
    },
    {
      date: '2002-12-27',
      value: '32.38',
    },
    {
      date: '2002-12-20',
      value: '30.35',
    },
    {
      date: '2002-12-13',
      value: '27.82',
    },
    {
      date: '2002-12-06',
      value: '27.14',
    },
    {
      date: '2002-11-29',
      value: '26.83',
    },
    {
      date: '2002-11-22',
      value: '26.98',
    },
    {
      date: '2002-11-15',
      value: '25.68',
    },
    {
      date: '2002-11-08',
      value: '25.97',
    },
    {
      date: '2002-11-01',
      value: '27.03',
    },
    {
      date: '2002-10-25',
      value: '27.88',
    },
    {
      date: '2002-10-18',
      value: '29.65',
    },
    {
      date: '2002-10-11',
      value: '29.37',
    },
    {
      date: '2002-10-04',
      value: '30.25',
    },
    {
      date: '2002-09-27',
      value: '30.63',
    },
    {
      date: '2002-09-20',
      value: '29.39',
    },
    {
      date: '2002-09-13',
      value: '29.59',
    },
    {
      date: '2002-09-06',
      value: '28.65',
    },
    {
      date: '2002-08-30',
      value: '28.84',
    },
    {
      date: '2002-08-23',
      value: '30.09',
    },
    {
      date: '2002-08-16',
      value: '28.52',
    },
    {
      date: '2002-08-09',
      value: '26.77',
    },
    {
      date: '2002-08-02',
      value: '26.87',
    },
    {
      date: '2002-07-26',
      value: '26.64',
    },
    {
      date: '2002-07-19',
      value: '27.62',
    },
    {
      date: '2002-07-12',
      value: '26.70',
    },
    {
      date: '2002-07-05',
      value: '26.81',
    },
    {
      date: '2002-06-28',
      value: '26.52',
    },
    {
      date: '2002-06-21',
      value: '25.61',
    },
    {
      date: '2002-06-14',
      value: '24.94',
    },
    {
      date: '2002-06-07',
      value: '25.01',
    },
    {
      date: '2002-05-31',
      value: '25.22',
    },
    {
      date: '2002-05-24',
      value: '27.18',
    },
    {
      date: '2002-05-17',
      value: '28.43',
    },
    {
      date: '2002-05-10',
      value: '27.27',
    },
    {
      date: '2002-05-03',
      value: '26.88',
    },
    {
      date: '2002-04-26',
      value: '26.46',
    },
    {
      date: '2002-04-19',
      value: '25.54',
    },
    {
      date: '2002-04-12',
      value: '25.24',
    },
    {
      date: '2002-04-05',
      value: '26.99',
    },
    {
      date: '2002-03-29',
      value: '25.86',
    },
    {
      date: '2002-03-22',
      value: '25.25',
    },
    {
      date: '2002-03-15',
      value: '24.40',
    },
    {
      date: '2002-03-08',
      value: '23.31',
    },
    {
      date: '2002-03-01',
      value: '21.43',
    },
    {
      date: '2002-02-22',
      value: '20.70',
    },
    {
      date: '2002-02-15',
      value: '21.18',
    },
    {
      date: '2002-02-08',
      value: '19.97',
    },
    {
      date: '2002-02-01',
      value: '19.71',
    },
    {
      date: '2002-01-25',
      value: '19.21',
    },
    {
      date: '2002-01-18',
      value: '18.61',
    },
    {
      date: '2002-01-11',
      value: '20.54',
    },
    {
      date: '2002-01-04',
      value: '20.80',
    },
    {
      date: '2001-12-28',
      value: '20.94',
    },
    {
      date: '2001-12-21',
      value: '19.20',
    },
    {
      date: '2001-12-14',
      value: '18.45',
    },
    {
      date: '2001-12-07',
      value: '19.47',
    },
    {
      date: '2001-11-30',
      value: '19.13',
    },
    {
      date: '2001-11-23',
      value: '18.28',
    },
    {
      date: '2001-11-16',
      value: '19.61',
    },
    {
      date: '2001-11-09',
      value: '20.70',
    },
    {
      date: '2001-11-02',
      value: '21.17',
    },
    {
      date: '2001-10-26',
      value: '21.78',
    },
    {
      date: '2001-10-19',
      value: '21.92',
    },
    {
      date: '2001-10-12',
      value: '22.66',
    },
    {
      date: '2001-10-05',
      value: '22.60',
    },
    {
      date: '2001-09-28',
      value: '22.35',
    },
    {
      date: '2001-09-21',
      value: '27.09',
    },
    {
      date: '2001-09-14',
      value: '28.22',
    },
    {
      date: '2001-09-07',
      value: '27.38',
    },
    {
      date: '2001-08-31',
      value: '26.84',
    },
    {
      date: '2001-08-24',
      value: '27.25',
    },
    {
      date: '2001-08-17',
      value: '27.52',
    },
    {
      date: '2001-08-10',
      value: '27.87',
    },
    {
      date: '2001-08-03',
      value: '27.10',
    },
    {
      date: '2001-07-27',
      value: '26.50',
    },
    {
      date: '2001-07-20',
      value: '25.26',
    },
    {
      date: '2001-07-13',
      value: '27.07',
    },
    {
      date: '2001-07-06',
      value: '26.87',
    },
    {
      date: '2001-06-29',
      value: '26.37',
    },
    {
      date: '2001-06-22',
      value: '27.09',
    },
    {
      date: '2001-06-15',
      value: '28.90',
    },
    {
      date: '2001-06-08',
      value: '27.98',
    },
    {
      date: '2001-06-01',
      value: '28.44',
    },
    {
      date: '2001-05-25',
      value: '28.92',
    },
    {
      date: '2001-05-18',
      value: '29.08',
    },
    {
      date: '2001-05-11',
      value: '28.12',
    },
    {
      date: '2001-05-04',
      value: '28.36',
    },
    {
      date: '2001-04-27',
      value: '26.99',
    },
    {
      date: '2001-04-20',
      value: '27.89',
    },
    {
      date: '2001-04-13',
      value: '28.27',
    },
    {
      date: '2001-04-06',
      value: '26.76',
    },
    {
      date: '2001-03-30',
      value: '26.86',
    },
    {
      date: '2001-03-23',
      value: '26.42',
    },
    {
      date: '2001-03-16',
      value: '27.02',
    },
    {
      date: '2001-03-09',
      value: '28.45',
    },
    {
      date: '2001-03-02',
      value: '27.91',
    },
    {
      date: '2001-02-23',
      value: '28.65',
    },
    {
      date: '2001-02-16',
      value: '29.67',
    },
    {
      date: '2001-02-09',
      value: '30.92',
    },
    {
      date: '2001-02-02',
      value: '29.59',
    },
    {
      date: '2001-01-26',
      value: '31.35',
    },
    {
      date: '2001-01-19',
      value: '30.63',
    },
    {
      date: '2001-01-12',
      value: '28.81',
    },
    {
      date: '2001-01-05',
      value: '27.80',
    },
    {
      date: '2000-12-29',
      value: '26.52',
    },
    {
      date: '2000-12-22',
      value: '27.38',
    },
    {
      date: '2000-12-15',
      value: '29.05',
    },
    {
      date: '2000-12-08',
      value: '29.69',
    },
    {
      date: '2000-12-01',
      value: '34.10',
    },
    {
      date: '2000-11-24',
      value: '35.91',
    },
    {
      date: '2000-11-17',
      value: '35.00',
    },
    {
      date: '2000-11-10',
      value: '33.46',
    },
    {
      date: '2000-11-03',
      value: '32.78',
    },
    {
      date: '2000-10-27',
      value: '33.92',
    },
    {
      date: '2000-10-20',
      value: '33.48',
    },
    {
      date: '2000-10-13',
      value: '33.90',
    },
    {
      date: '2000-10-06',
      value: '31.27',
    },
    {
      date: '2000-09-29',
      value: '31.13',
    },
    {
      date: '2000-09-22',
      value: '35.49',
    },
    {
      date: '2000-09-15',
      value: '34.70',
    },
    {
      date: '2000-09-08',
      value: '34.42',
    },
    {
      date: '2000-09-01',
      value: '33.08',
    },
    {
      date: '2000-08-25',
      value: '32.46',
    },
    {
      date: '2000-08-18',
      value: '31.82',
    },
    {
      date: '2000-08-11',
      value: '30.14',
    },
    {
      date: '2000-08-04',
      value: '28.50',
    },
    {
      date: '2000-07-28',
      value: '28.02',
    },
    {
      date: '2000-07-21',
      value: '30.65',
    },
    {
      date: '2000-07-14',
      value: '30.44',
    },
    {
      date: '2000-07-07',
      value: '30.40',
    },
    {
      date: '2000-06-30',
      value: '32.12',
    },
    {
      date: '2000-06-23',
      value: '33.55',
    },
    {
      date: '2000-06-16',
      value: '32.45',
    },
    {
      date: '2000-06-09',
      value: '29.79',
    },
    {
      date: '2000-06-02',
      value: '29.98',
    },
    {
      date: '2000-05-26',
      value: '29.46',
    },
    {
      date: '2000-05-19',
      value: '29.88',
    },
    {
      date: '2000-05-12',
      value: '28.70',
    },
    {
      date: '2000-05-05',
      value: '26.75',
    },
    {
      date: '2000-04-28',
      value: '25.95',
    },
    {
      date: '2000-04-21',
      value: '26.66',
    },
    {
      date: '2000-04-14',
      value: '24.87',
    },
    {
      date: '2000-04-07',
      value: '25.60',
    },
    {
      date: '2000-03-31',
      value: '26.92',
    },
    {
      date: '2000-03-24',
      value: '27.99',
    },
    {
      date: '2000-03-17',
      value: '31.29',
    },
    {
      date: '2000-03-10',
      value: '32.14',
    },
    {
      date: '2000-03-03',
      value: '31.07',
    },
    {
      date: '2000-02-25',
      value: '30.10',
    },
    {
      date: '2000-02-18',
      value: '29.87',
    },
    {
      date: '2000-02-11',
      value: '28.83',
    },
    {
      date: '2000-02-04',
      value: '28.08',
    },
    {
      date: '2000-01-28',
      value: '28.34',
    },
    {
      date: '2000-01-21',
      value: '29.37',
    },
    {
      date: '2000-01-14',
      value: '26.27',
    },
    {
      date: '2000-01-07',
      value: '24.95',
    },
    {
      date: '1999-12-31',
      value: '26.34',
    },
    {
      date: '1999-12-24',
      value: '26.07',
    },
    {
      date: '1999-12-17',
      value: '26.20',
    },
    {
      date: '1999-12-10',
      value: '26.19',
    },
    {
      date: '1999-12-03',
      value: '25.46',
    },
    {
      date: '1999-11-26',
      value: '27.35',
    },
    {
      date: '1999-11-19',
      value: '26.05',
    },
    {
      date: '1999-11-12',
      value: '24.22',
    },
    {
      date: '1999-11-05',
      value: '22.72',
    },
    {
      date: '1999-10-29',
      value: '22.50',
    },
    {
      date: '1999-10-22',
      value: '22.65',
    },
    {
      date: '1999-10-15',
      value: '22.54',
    },
    {
      date: '1999-10-08',
      value: '22.72',
    },
    {
      date: '1999-10-01',
      value: '24.58',
    },
    {
      date: '1999-09-24',
      value: '24.53',
    },
    {
      date: '1999-09-17',
      value: '24.28',
    },
    {
      date: '1999-09-10',
      value: '23.00',
    },
    {
      date: '1999-09-03',
      value: '21.88',
    },
    {
      date: '1999-08-27',
      value: '21.21',
    },
    {
      date: '1999-08-20',
      value: '21.62',
    },
    {
      date: '1999-08-13',
      value: '21.44',
    },
    {
      date: '1999-08-06',
      value: '20.54',
    },
    {
      date: '1999-07-30',
      value: '20.62',
    },
    {
      date: '1999-07-23',
      value: '19.89',
    },
    {
      date: '1999-07-16',
      value: '20.21',
    },
    {
      date: '1999-07-09',
      value: '19.87',
    },
    {
      date: '1999-07-02',
      value: '19.04',
    },
    {
      date: '1999-06-25',
      value: '18.05',
    },
    {
      date: '1999-06-18',
      value: '18.21',
    },
    {
      date: '1999-06-11',
      value: '17.96',
    },
    {
      date: '1999-06-04',
      value: '16.77',
    },
    {
      date: '1999-05-28',
      value: '17.07',
    },
    {
      date: '1999-05-21',
      value: '17.18',
    },
    {
      date: '1999-05-14',
      value: '18.00',
    },
    {
      date: '1999-05-07',
      value: '18.62',
    },
    {
      date: '1999-04-30',
      value: '18.23',
    },
    {
      date: '1999-04-23',
      value: '17.93',
    },
    {
      date: '1999-04-16',
      value: '16.77',
    },
    {
      date: '1999-04-09',
      value: '16.45',
    },
    {
      date: '1999-04-02',
      value: '16.61',
    },
    {
      date: '1999-03-26',
      value: '15.55',
    },
    {
      date: '1999-03-19',
      value: '14.91',
    },
    {
      date: '1999-03-12',
      value: '14.19',
    },
    {
      date: '1999-03-05',
      value: '12.90',
    },
    {
      date: '1999-02-26',
      value: '12.36',
    },
    {
      date: '1999-02-19',
      value: '11.66',
    },
    {
      date: '1999-02-12',
      value: '11.81',
    },
    {
      date: '1999-02-05',
      value: '12.16',
    },
    {
      date: '1999-01-29',
      value: '12.46',
    },
    {
      date: '1999-01-22',
      value: '12.26',
    },
    {
      date: '1999-01-15',
      value: '12.62',
    },
    {
      date: '1999-01-08',
      value: '12.67',
    },
    {
      date: '1999-01-01',
      value: '11.83',
    },
    {
      date: '1998-12-25',
      value: '11.00',
    },
    {
      date: '1998-12-18',
      value: '11.50',
    },
    {
      date: '1998-12-11',
      value: '11.16',
    },
    {
      date: '1998-12-04',
      value: '11.28',
    },
    {
      date: '1998-11-27',
      value: '11.62',
    },
    {
      date: '1998-11-20',
      value: '12.40',
    },
    {
      date: '1998-11-13',
      value: '13.63',
    },
    {
      date: '1998-11-06',
      value: '14.13',
    },
    {
      date: '1998-10-30',
      value: '14.34',
    },
    {
      date: '1998-10-23',
      value: '13.81',
    },
    {
      date: '1998-10-16',
      value: '14.21',
    },
    {
      date: '1998-10-09',
      value: '15.02',
    },
    {
      date: '1998-10-02',
      value: '15.83',
    },
    {
      date: '1998-09-25',
      value: '15.78',
    },
    {
      date: '1998-09-18',
      value: '14.88',
    },
    {
      date: '1998-09-11',
      value: '14.45',
    },
    {
      date: '1998-09-04',
      value: '13.98',
    },
    {
      date: '1998-08-28',
      value: '13.65',
    },
    {
      date: '1998-08-21',
      value: '13.33',
    },
    {
      date: '1998-08-14',
      value: '13.12',
    },
    {
      date: '1998-08-07',
      value: '13.83',
    },
    {
      date: '1998-07-31',
      value: '14.24',
    },
    {
      date: '1998-07-24',
      value: '13.89',
    },
    {
      date: '1998-07-17',
      value: '14.48',
    },
    {
      date: '1998-07-10',
      value: '13.94',
    },
    {
      date: '1998-07-03',
      value: '14.41',
    },
    {
      date: '1998-06-26',
      value: '14.17',
    },
    {
      date: '1998-06-19',
      value: '12.04',
    },
    {
      date: '1998-06-12',
      value: '13.42',
    },
    {
      date: '1998-06-05',
      value: '15.02',
    },
    {
      date: '1998-05-29',
      value: '14.99',
    },
    {
      date: '1998-05-22',
      value: '13.91',
    },
    {
      date: '1998-05-15',
      value: '15.03',
    },
    {
      date: '1998-05-08',
      value: '15.48',
    },
    {
      date: '1998-05-01',
      value: '15.71',
    },
    {
      date: '1998-04-24',
      value: '14.50',
    },
    {
      date: '1998-04-17',
      value: '15.53',
    },
    {
      date: '1998-04-10',
      value: '15.55',
    },
    {
      date: '1998-04-03',
      value: '15.98',
    },
    {
      date: '1998-03-27',
      value: '16.42',
    },
    {
      date: '1998-03-20',
      value: '14.04',
    },
    {
      date: '1998-03-13',
      value: '14.40',
    },
    {
      date: '1998-03-06',
      value: '15.23',
    },
    {
      date: '1998-02-27',
      value: '15.30',
    },
    {
      date: '1998-02-20',
      value: '16.03',
    },
    {
      date: '1998-02-13',
      value: '16.25',
    },
    {
      date: '1998-02-06',
      value: '16.65',
    },
    {
      date: '1998-01-30',
      value: '17.30',
    },
    {
      date: '1998-01-23',
      value: '16.02',
    },
    {
      date: '1998-01-16',
      value: '16.47',
    },
    {
      date: '1998-01-09',
      value: '16.83',
    },
    {
      date: '1998-01-02',
      value: '17.58',
    },
    {
      date: '1997-12-26',
      value: '18.31',
    },
    {
      date: '1997-12-19',
      value: '18.31',
    },
    {
      date: '1997-12-12',
      value: '18.44',
    },
    {
      date: '1997-12-05',
      value: '18.69',
    },
    {
      date: '1997-11-28',
      value: '19.30',
    },
    {
      date: '1997-11-21',
      value: '19.81',
    },
    {
      date: '1997-11-14',
      value: '20.66',
    },
    {
      date: '1997-11-07',
      value: '20.65',
    },
    {
      date: '1997-10-31',
      value: '20.92',
    },
    {
      date: '1997-10-24',
      value: '21.00',
    },
    {
      date: '1997-10-17',
      value: '21.03',
    },
    {
      date: '1997-10-10',
      value: '22.01',
    },
    {
      date: '1997-10-03',
      value: '21.62',
    },
    {
      date: '1997-09-26',
      value: '20.12',
    },
    {
      date: '1997-09-19',
      value: '19.44',
    },
    {
      date: '1997-09-12',
      value: '19.44',
    },
    {
      date: '1997-09-05',
      value: '19.61',
    },
    {
      date: '1997-08-29',
      value: '19.50',
    },
    {
      date: '1997-08-22',
      value: '19.92',
    },
    {
      date: '1997-08-15',
      value: '19.99',
    },
    {
      date: '1997-08-08',
      value: '20.35',
    },
    {
      date: '1997-08-01',
      value: '20.13',
    },
    {
      date: '1997-07-25',
      value: '19.52',
    },
    {
      date: '1997-07-18',
      value: '19.49',
    },
    {
      date: '1997-07-11',
      value: '19.44',
    },
    {
      date: '1997-07-04',
      value: '19.95',
    },
    {
      date: '1997-06-27',
      value: '19.00',
    },
    {
      date: '1997-06-20',
      value: '18.93',
    },
    {
      date: '1997-06-13',
      value: '18.88',
    },
    {
      date: '1997-06-06',
      value: '20.12',
    },
    {
      date: '1997-05-30',
      value: '20.90',
    },
    {
      date: '1997-05-23',
      value: '21.43',
    },
    {
      date: '1997-05-16',
      value: '21.45',
    },
    {
      date: '1997-05-09',
      value: '19.94',
    },
    {
      date: '1997-05-02',
      value: '19.99',
    },
    {
      date: '1997-04-25',
      value: '19.85',
    },
    {
      date: '1997-04-18',
      value: '19.65',
    },
    {
      date: '1997-04-11',
      value: '19.38',
    },
    {
      date: '1997-04-04',
      value: '19.76',
    },
    {
      date: '1997-03-28',
      value: '20.83',
    },
    {
      date: '1997-03-21',
      value: '21.72',
    },
    {
      date: '1997-03-14',
      value: '20.64',
    },
    {
      date: '1997-03-07',
      value: '20.77',
    },
    {
      date: '1997-02-28',
      value: '20.83',
    },
    {
      date: '1997-02-21',
      value: '22.18',
    },
    {
      date: '1997-02-14',
      value: '22.21',
    },
    {
      date: '1997-02-07',
      value: '23.49',
    },
    {
      date: '1997-01-31',
      value: '24.24',
    },
    {
      date: '1997-01-24',
      value: '24.40',
    },
    {
      date: '1997-01-17',
      value: '25.42',
    },
    {
      date: '1997-01-10',
      value: '26.30',
    },
    {
      date: '1997-01-03',
      value: '25.59',
    },
    {
      date: '1996-12-27',
      value: '25.44',
    },
    {
      date: '1996-12-20',
      value: '26.02',
    },
    {
      date: '1996-12-13',
      value: '24.20',
    },
    {
      date: '1996-12-06',
      value: '25.14',
    },
    {
      date: '1996-11-29',
      value: '24.21',
    },
    {
      date: '1996-11-22',
      value: '24.03',
    },
    {
      date: '1996-11-15',
      value: '23.90',
    },
    {
      date: '1996-11-08',
      value: '22.92',
    },
    {
      date: '1996-11-01',
      value: '23.91',
    },
    {
      date: '1996-10-25',
      value: '25.15',
    },
    {
      date: '1996-10-18',
      value: '25.45',
    },
    {
      date: '1996-10-11',
      value: '24.93',
    },
    {
      date: '1996-10-04',
      value: '24.44',
    },
    {
      date: '1996-09-27',
      value: '24.33',
    },
    {
      date: '1996-09-20',
      value: '23.52',
    },
    {
      date: '1996-09-13',
      value: '24.42',
    },
    {
      date: '1996-09-06',
      value: '23.48',
    },
    {
      date: '1996-08-30',
      value: '21.82',
    },
    {
      date: '1996-08-23',
      value: '22.50',
    },
    {
      date: '1996-08-16',
      value: '22.25',
    },
    {
      date: '1996-08-09',
      value: '21.35',
    },
    {
      date: '1996-08-02',
      value: '20.66',
    },
    {
      date: '1996-07-26',
      value: '20.96',
    },
    {
      date: '1996-07-19',
      value: '21.80',
    },
    {
      date: '1996-07-12',
      value: '21.65',
    },
    {
      date: '1996-07-05',
      value: '21.40',
    },
    {
      date: '1996-06-28',
      value: '20.55',
    },
    {
      date: '1996-06-21',
      value: '20.95',
    },
    {
      date: '1996-06-14',
      value: '20.15',
    },
    {
      date: '1996-06-07',
      value: '20.04',
    },
    {
      date: '1996-05-31',
      value: '20.37',
    },
    {
      date: '1996-05-24',
      value: '22.24',
    },
    {
      date: '1996-05-17',
      value: '21.06',
    },
    {
      date: '1996-05-10',
      value: '20.98',
    },
    {
      date: '1996-05-03',
      value: '21.16',
    },
    {
      date: '1996-04-26',
      value: '23.80',
    },
    {
      date: '1996-04-19',
      value: '24.34',
    },
    {
      date: '1996-04-12',
      value: '23.95',
    },
    {
      date: '1996-04-05',
      value: '22.49',
    },
    {
      date: '1996-03-29',
      value: '22.03',
    },
    {
      date: '1996-03-22',
      value: '23.16',
    },
    {
      date: '1996-03-15',
      value: '20.80',
    },
    {
      date: '1996-03-08',
      value: '19.72',
    },
    {
      date: '1996-03-01',
      value: '19.49',
    },
    {
      date: '1996-02-23',
      value: '21.45',
    },
    {
      date: '1996-02-16',
      value: '18.80',
    },
    {
      date: '1996-02-09',
      value: '17.72',
    },
    {
      date: '1996-02-02',
      value: '17.64',
    },
    {
      date: '1996-01-26',
      value: '18.35',
    },
    {
      date: '1996-01-19',
      value: '18.64',
    },
    {
      date: '1996-01-12',
      value: '19.43',
    },
    {
      date: '1996-01-05',
      value: '19.99',
    },
    {
      date: '1995-12-29',
      value: '19.44',
    },
    {
      date: '1995-12-22',
      value: '19.12',
    },
    {
      date: '1995-12-15',
      value: '19.02',
    },
    {
      date: '1995-12-08',
      value: '18.74',
    },
    {
      date: '1995-12-01',
      value: '18.32',
    },
    {
      date: '1995-11-24',
      value: '17.99',
    },
    {
      date: '1995-11-17',
      value: '18.06',
    },
    {
      date: '1995-11-10',
      value: '17.76',
    },
    {
      date: '1995-11-03',
      value: '17.79',
    },
    {
      date: '1995-10-27',
      value: '17.56',
    },
    {
      date: '1995-10-20',
      value: '17.51',
    },
    {
      date: '1995-10-13',
      value: '17.28',
    },
    {
      date: '1995-10-06',
      value: '17.29',
    },
    {
      date: '1995-09-29',
      value: '17.55',
    },
    {
      date: '1995-09-22',
      value: '18.32',
    },
    {
      date: '1995-09-15',
      value: '18.72',
    },
    {
      date: '1995-09-08',
      value: '18.37',
    },
    {
      date: '1995-09-01',
      value: '17.88',
    },
    {
      date: '1995-08-25',
      value: '19.02',
    },
    {
      date: '1995-08-18',
      value: '17.60',
    },
    {
      date: '1995-08-11',
      value: '17.81',
    },
    {
      date: '1995-08-04',
      value: '17.72',
    },
    {
      date: '1995-07-28',
      value: '17.41',
    },
    {
      date: '1995-07-21',
      value: '17.21',
    },
    {
      date: '1995-07-14',
      value: '17.34',
    },
    {
      date: '1995-07-07',
      value: '17.28',
    },
    {
      date: '1995-06-30',
      value: '17.71',
    },
    {
      date: '1995-06-23',
      value: '17.88',
    },
    {
      date: '1995-06-16',
      value: '18.91',
    },
    {
      date: '1995-06-09',
      value: '19.05',
    },
    {
      date: '1995-06-02',
      value: '18.92',
    },
    {
      date: '1995-05-26',
      value: '19.37',
    },
    {
      date: '1995-05-19',
      value: '19.98',
    },
    {
      date: '1995-05-12',
      value: '19.74',
    },
    {
      date: '1995-05-05',
      value: '20.24',
    },
    {
      date: '1995-04-28',
      value: '20.29',
    },
    {
      date: '1995-04-21',
      value: '20.26',
    },
    {
      date: '1995-04-14',
      value: '19.53',
    },
    {
      date: '1995-04-07',
      value: '19.43',
    },
    {
      date: '1995-03-31',
      value: '19.12',
    },
    {
      date: '1995-03-24',
      value: '18.69',
    },
    {
      date: '1995-03-17',
      value: '18.13',
    },
    {
      date: '1995-03-10',
      value: '18.27',
    },
    {
      date: '1995-03-03',
      value: '18.50',
    },
    {
      date: '1995-02-24',
      value: '18.75',
    },
    {
      date: '1995-02-17',
      value: '18.55',
    },
    {
      date: '1995-02-10',
      value: '18.42',
    },
    {
      date: '1995-02-03',
      value: '18.50',
    },
    {
      date: '1995-01-27',
      value: '18.34',
    },
    {
      date: '1995-01-20',
      value: '18.45',
    },
    {
      date: '1995-01-13',
      value: '17.55',
    },
    {
      date: '1995-01-06',
      value: '17.62',
    },
    {
      date: '1994-12-30',
      value: '17.71',
    },
    {
      date: '1994-12-23',
      value: '17.10',
    },
    {
      date: '1994-12-16',
      value: '16.86',
    },
    {
      date: '1994-12-09',
      value: '16.99',
    },
    {
      date: '1994-12-02',
      value: '17.78',
    },
    {
      date: '1994-11-25',
      value: '17.73',
    },
    {
      date: '1994-11-18',
      value: '17.51',
    },
    {
      date: '1994-11-11',
      value: '18.25',
    },
    {
      date: '1994-11-04',
      value: '18.69',
    },
    {
      date: '1994-10-28',
      value: '17.93',
    },
    {
      date: '1994-10-21',
      value: '17.35',
    },
    {
      date: '1994-10-14',
      value: '17.37',
    },
    {
      date: '1994-10-07',
      value: '18.13',
    },
    {
      date: '1994-09-30',
      value: '17.83',
    },
    {
      date: '1994-09-23',
      value: '17.38',
    },
    {
      date: '1994-09-16',
      value: '16.93',
    },
    {
      date: '1994-09-09',
      value: '17.65',
    },
    {
      date: '1994-09-02',
      value: '17.52',
    },
    {
      date: '1994-08-26',
      value: '17.23',
    },
    {
      date: '1994-08-19',
      value: '17.85',
    },
    {
      date: '1994-08-12',
      value: '18.88',
    },
    {
      date: '1994-08-05',
      value: '20.09',
    },
    {
      date: '1994-07-29',
      value: '19.66',
    },
    {
      date: '1994-07-22',
      value: '19.39',
    },
    {
      date: '1994-07-15',
      value: '20.16',
    },
    {
      date: '1994-07-08',
      value: '19.39',
    },
    {
      date: '1994-07-01',
      value: '19.16',
    },
    {
      date: '1994-06-24',
      value: '19.80',
    },
    {
      date: '1994-06-17',
      value: '19.61',
    },
    {
      date: '1994-06-10',
      value: '18.26',
    },
    {
      date: '1994-06-03',
      value: '18.24',
    },
    {
      date: '1994-05-27',
      value: '18.14',
    },
    {
      date: '1994-05-20',
      value: '18.21',
    },
    {
      date: '1994-05-13',
      value: '17.93',
    },
    {
      date: '1994-05-06',
      value: '17.20',
    },
    {
      date: '1994-04-29',
      value: '16.93',
    },
    {
      date: '1994-04-22',
      value: '17.02',
    },
    {
      date: '1994-04-15',
      value: '16.07',
    },
    {
      date: '1994-04-08',
      value: '15.65',
    },
    {
      date: '1994-04-01',
      value: '14.44',
    },
    {
      date: '1994-03-25',
      value: '15.15',
    },
    {
      date: '1994-03-18',
      value: '14.82',
    },
    {
      date: '1994-03-11',
      value: '14.24',
    },
    {
      date: '1994-03-04',
      value: '14.68',
    },
    {
      date: '1994-02-25',
      value: '14.44',
    },
    {
      date: '1994-02-18',
      value: '14.13',
    },
    {
      date: '1994-02-11',
      value: '14.87',
    },
    {
      date: '1994-02-04',
      value: '15.76',
    },
    {
      date: '1994-01-28',
      value: '15.34',
    },
    {
      date: '1994-01-21',
      value: '15.02',
    },
    {
      date: '1994-01-14',
      value: '14.67',
    },
    {
      date: '1994-01-07',
      value: '15.03',
    },
    {
      date: '1993-12-31',
      value: '14.21',
    },
    {
      date: '1993-12-24',
      value: '14.40',
    },
    {
      date: '1993-12-17',
      value: '14.31',
    },
    {
      date: '1993-12-10',
      value: '14.68',
    },
    {
      date: '1993-12-03',
      value: '15.21',
    },
    {
      date: '1993-11-26',
      value: '16.08',
    },
    {
      date: '1993-11-19',
      value: '16.75',
    },
    {
      date: '1993-11-12',
      value: '16.71',
    },
    {
      date: '1993-11-05',
      value: '17.29',
    },
    {
      date: '1993-10-29',
      value: '17.37',
    },
    {
      date: '1993-10-22',
      value: '18.12',
    },
    {
      date: '1993-10-15',
      value: '18.57',
    },
    {
      date: '1993-10-08',
      value: '18.46',
    },
    {
      date: '1993-10-01',
      value: '18.33',
    },
    {
      date: '1993-09-24',
      value: '17.67',
    },
    {
      date: '1993-09-17',
      value: '16.94',
    },
    {
      date: '1993-09-10',
      value: '16.96',
    },
    {
      date: '1993-09-03',
      value: '18.10',
    },
    {
      date: '1993-08-27',
      value: '18.49',
    },
    {
      date: '1993-08-20',
      value: '17.84',
    },
    {
      date: '1993-08-13',
      value: '17.87',
    },
    {
      date: '1993-08-06',
      value: '17.67',
    },
    {
      date: '1993-07-30',
      value: '18.18',
    },
    {
      date: '1993-07-23',
      value: '17.54',
    },
    {
      date: '1993-07-16',
      value: '17.72',
    },
    {
      date: '1993-07-09',
      value: '18.02',
    },
    {
      date: '1993-07-02',
      value: '18.61',
    },
    {
      date: '1993-06-25',
      value: '18.52',
    },
    {
      date: '1993-06-18',
      value: '18.76',
    },
    {
      date: '1993-06-11',
      value: '19.43',
    },
    {
      date: '1993-06-04',
      value: '19.95',
    },
    {
      date: '1993-05-28',
      value: '19.84',
    },
    {
      date: '1993-05-21',
      value: '19.43',
    },
    {
      date: '1993-05-14',
      value: '20.06',
    },
    {
      date: '1993-05-07',
      value: '20.47',
    },
    {
      date: '1993-04-30',
      value: '20.30',
    },
    {
      date: '1993-04-23',
      value: '19.95',
    },
    {
      date: '1993-04-16',
      value: '20.28',
    },
    {
      date: '1993-04-09',
      value: '20.37',
    },
    {
      date: '1993-04-02',
      value: '20.44',
    },
    {
      date: '1993-03-26',
      value: '20.00',
    },
    {
      date: '1993-03-19',
      value: '20.14',
    },
    {
      date: '1993-03-12',
      value: '20.45',
    },
    {
      date: '1993-03-05',
      value: '20.69',
    },
    {
      date: '1993-02-26',
      value: '20.40',
    },
    {
      date: '1993-02-19',
      value: '19.51',
    },
    {
      date: '1993-02-12',
      value: '20.13',
    },
    {
      date: '1993-02-05',
      value: '20.22',
    },
    {
      date: '1993-01-29',
      value: '19.90',
    },
    {
      date: '1993-01-22',
      value: '18.61',
    },
    {
      date: '1993-01-15',
      value: '18.62',
    },
    {
      date: '1993-01-08',
      value: '19.00',
    },
    {
      date: '1993-01-01',
      value: '19.63',
    },
    {
      date: '1992-12-25',
      value: '19.91',
    },
    {
      date: '1992-12-18',
      value: '19.38',
    },
    {
      date: '1992-12-11',
      value: '19.01',
    },
    {
      date: '1992-12-04',
      value: '19.38',
    },
    {
      date: '1992-11-27',
      value: '20.16',
    },
    {
      date: '1992-11-20',
      value: '20.35',
    },
    {
      date: '1992-11-13',
      value: '20.37',
    },
    {
      date: '1992-11-06',
      value: '20.52',
    },
    {
      date: '1992-10-30',
      value: '20.95',
    },
    {
      date: '1992-10-23',
      value: '21.58',
    },
    {
      date: '1992-10-16',
      value: '22.25',
    },
    {
      date: '1992-10-09',
      value: '21.90',
    },
    {
      date: '1992-10-02',
      value: '21.81',
    },
    {
      date: '1992-09-25',
      value: '21.71',
    },
    {
      date: '1992-09-18',
      value: '22.21',
    },
    {
      date: '1992-09-11',
      value: '21.94',
    },
    {
      date: '1992-09-04',
      value: '21.66',
    },
    {
      date: '1992-08-28',
      value: '21.43',
    },
    {
      date: '1992-08-21',
      value: '21.39',
    },
    {
      date: '1992-08-14',
      value: '21.18',
    },
    {
      date: '1992-08-07',
      value: '21.34',
    },
    {
      date: '1992-07-31',
      value: '21.95',
    },
    {
      date: '1992-07-24',
      value: '21.95',
    },
    {
      date: '1992-07-17',
      value: '21.58',
    },
    {
      date: '1992-07-10',
      value: '21.48',
    },
    {
      date: '1992-07-03',
      value: '22.03',
    },
    {
      date: '1992-06-26',
      value: '22.68',
    },
    {
      date: '1992-06-19',
      value: '22.26',
    },
    {
      date: '1992-06-12',
      value: '22.35',
    },
    {
      date: '1992-06-05',
      value: '22.38',
    },
    {
      date: '1992-05-29',
      value: '21.98',
    },
    {
      date: '1992-05-22',
      value: '20.49',
    },
    {
      date: '1992-05-15',
      value: '20.80',
    },
    {
      date: '1992-05-08',
      value: '20.86',
    },
    {
      date: '1992-05-01',
      value: '20.63',
    },
    {
      date: '1992-04-24',
      value: '20.06',
    },
    {
      date: '1992-04-17',
      value: '20.06',
    },
    {
      date: '1992-04-10',
      value: '20.43',
    },
    {
      date: '1992-04-03',
      value: '19.73',
    },
    {
      date: '1992-03-27',
      value: '19.09',
    },
    {
      date: '1992-03-20',
      value: '19.10',
    },
    {
      date: '1992-03-13',
      value: '18.76',
    },
    {
      date: '1992-03-06',
      value: '18.55',
    },
    {
      date: '1992-02-28',
      value: '18.51',
    },
    {
      date: '1992-02-21',
      value: '18.62',
    },
    {
      date: '1992-02-14',
      value: '19.49',
    },
    {
      date: '1992-02-07',
      value: '19.42',
    },
    {
      date: '1992-01-31',
      value: '19.05',
    },
    {
      date: '1992-01-24',
      value: '18.66',
    },
    {
      date: '1992-01-17',
      value: '18.81',
    },
    {
      date: '1992-01-10',
      value: '18.41',
    },
    {
      date: '1992-01-03',
      value: '19.11',
    },
    {
      date: '1991-12-27',
      value: '18.68',
    },
    {
      date: '1991-12-20',
      value: '19.20',
    },
    {
      date: '1991-12-13',
      value: '19.64',
    },
    {
      date: '1991-12-06',
      value: '20.55',
    },
    {
      date: '1991-11-29',
      value: '21.49',
    },
    {
      date: '1991-11-22',
      value: '22.04',
    },
    {
      date: '1991-11-15',
      value: '22.57',
    },
    {
      date: '1991-11-08',
      value: '23.47',
    },
    {
      date: '1991-11-01',
      value: '23.32',
    },
    {
      date: '1991-10-25',
      value: '23.46',
    },
    {
      date: '1991-10-18',
      value: '23.82',
    },
    {
      date: '1991-10-11',
      value: '23.08',
    },
    {
      date: '1991-10-04',
      value: '22.41',
    },
    {
      date: '1991-09-27',
      value: '22.24',
    },
    {
      date: '1991-09-20',
      value: '21.85',
    },
    {
      date: '1991-09-13',
      value: '21.54',
    },
    {
      date: '1991-09-06',
      value: '21.84',
    },
    {
      date: '1991-08-30',
      value: '21.98',
    },
    {
      date: '1991-08-23',
      value: '21.99',
    },
    {
      date: '1991-08-16',
      value: '21.44',
    },
    {
      date: '1991-08-09',
      value: '21.50',
    },
    {
      date: '1991-08-02',
      value: '21.46',
    },
    {
      date: '1991-07-26',
      value: '21.40',
    },
    {
      date: '1991-07-19',
      value: '21.91',
    },
    {
      date: '1991-07-12',
      value: '21.43',
    },
    {
      date: '1991-07-05',
      value: '20.80',
    },
    {
      date: '1991-06-28',
      value: '20.21',
    },
    {
      date: '1991-06-21',
      value: '20.08',
    },
    {
      date: '1991-06-14',
      value: '19.84',
    },
    {
      date: '1991-06-07',
      value: '20.63',
    },
    {
      date: '1991-05-31',
      value: '21.21',
    },
    {
      date: '1991-05-24',
      value: '21.04',
    },
    {
      date: '1991-05-17',
      value: '20.95',
    },
    {
      date: '1991-05-10',
      value: '21.69',
    },
    {
      date: '1991-05-03',
      value: '21.23',
    },
    {
      date: '1991-04-26',
      value: '21.19',
    },
    {
      date: '1991-04-19',
      value: '21.48',
    },
    {
      date: '1991-04-12',
      value: '20.89',
    },
    {
      date: '1991-04-05',
      value: '19.63',
    },
    {
      date: '1991-03-29',
      value: '19.58',
    },
    {
      date: '1991-03-22',
      value: '20.30',
    },
    {
      date: '1991-03-15',
      value: '19.89',
    },
    {
      date: '1991-03-08',
      value: '19.86',
    },
    {
      date: '1991-03-01',
      value: '18.73',
    },
    {
      date: '1991-02-22',
      value: '19.38',
    },
    {
      date: '1991-02-15',
      value: '22.12',
    },
    {
      date: '1991-02-08',
      value: '21.30',
    },
    {
      date: '1991-02-01',
      value: '21.41',
    },
    {
      date: '1991-01-25',
      value: '24.08',
    },
    {
      date: '1991-01-18',
      value: '26.85',
    },
    {
      date: '1991-01-11',
      value: '27.55',
    },
    {
      date: '1991-01-04',
      value: '26.38',
    },
    {
      date: '1990-12-28',
      value: '27.21',
    },
    {
      date: '1990-12-21',
      value: '27.56',
    },
    {
      date: '1990-12-14',
      value: '26.39',
    },
    {
      date: '1990-12-07',
      value: '27.72',
    },
    {
      date: '1990-11-30',
      value: '32.32',
    },
    {
      date: '1990-11-23',
      value: '30.69',
    },
    {
      date: '1990-11-16',
      value: '31.50',
    },
    {
      date: '1990-11-09',
      value: '33.89',
    },
    {
      date: '1990-11-02',
      value: '34.95',
    },
    {
      date: '1990-10-26',
      value: '31.32',
    },
    {
      date: '1990-10-19',
      value: '36.84',
    },
    {
      date: '1990-10-12',
      value: '39.88',
    },
    {
      date: '1990-10-05',
      value: '36.64',
    },
    {
      date: '1990-09-28',
      value: '39.16',
    },
    {
      date: '1990-09-21',
      value: '34.21',
    },
    {
      date: '1990-09-14',
      value: '30.99',
    },
    {
      date: '1990-09-07',
      value: '29.67',
    },
    {
      date: '1990-08-31',
      value: '27.13',
    },
    {
      date: '1990-08-24',
      value: '30.08',
    },
    {
      date: '1990-08-17',
      value: '27.27',
    },
    {
      date: '1990-08-10',
      value: '27.32',
    },
    {
      date: '1990-08-03',
      value: '21.98',
    },
    {
      date: '1990-07-27',
      value: '19.89',
    },
    {
      date: '1990-07-20',
      value: '18.83',
    },
    {
      date: '1990-07-13',
      value: '17.64',
    },
    {
      date: '1990-07-06',
      value: '16.68',
    },
    {
      date: '1990-06-29',
      value: '16.84',
    },
    {
      date: '1990-06-22',
      value: '15.90',
    },
    {
      date: '1990-06-15',
      value: '17.11',
    },
    {
      date: '1990-06-08',
      value: '16.77',
    },
    {
      date: '1990-06-01',
      value: '17.72',
    },
    {
      date: '1990-05-25',
      value: '16.83',
    },
    {
      date: '1990-05-18',
      value: '19.19',
    },
    {
      date: '1990-05-11',
      value: '18.71',
    },
    {
      date: '1990-05-04',
      value: '18.37',
    },
    {
      date: '1990-04-27',
      value: '18.20',
    },
    {
      date: '1990-04-20',
      value: '17.60',
    },
    {
      date: '1990-04-13',
      value: '17.96',
    },
    {
      date: '1990-04-06',
      value: '19.83',
    },
    {
      date: '1990-03-30',
      value: '20.26',
    },
    {
      date: '1990-03-23',
      value: '19.73',
    },
    {
      date: '1990-03-16',
      value: '20.19',
    },
    {
      date: '1990-03-09',
      value: '21.01',
    },
    {
      date: '1990-03-02',
      value: '21.51',
    },
    {
      date: '1990-02-23',
      value: '21.81',
    },
    {
      date: '1990-02-16',
      value: '22.27',
    },
    {
      date: '1990-02-09',
      value: '22.23',
    },
    {
      date: '1990-02-02',
      value: '22.70',
    },
    {
      date: '1990-01-26',
      value: '23.08',
    },
    {
      date: '1990-01-19',
      value: '22.71',
    },
    {
      date: '1990-01-12',
      value: '22.62',
    },
    {
      date: '1990-01-05',
      value: '23.29',
    },
    {
      date: '1989-12-29',
      value: '21.78',
    },
    {
      date: '1989-12-22',
      value: '21.76',
    },
    {
      date: '1989-12-15',
      value: '20.81',
    },
    {
      date: '1989-12-08',
      value: '20.36',
    },
    {
      date: '1989-12-01',
      value: '19.70',
    },
    {
      date: '1989-11-24',
      value: '20.02',
    },
    {
      date: '1989-11-17',
      value: '19.74',
    },
    {
      date: '1989-11-10',
      value: '19.89',
    },
    {
      date: '1989-11-03',
      value: '19.99',
    },
    {
      date: '1989-10-27',
      value: '19.65',
    },
    {
      date: '1989-10-20',
      value: '20.46',
    },
    {
      date: '1989-10-13',
      value: '20.37',
    },
    {
      date: '1989-10-06',
      value: '20.03',
    },
    {
      date: '1989-09-29',
      value: '19.77',
    },
    {
      date: '1989-09-22',
      value: '19.63',
    },
    {
      date: '1989-09-15',
      value: '19.80',
    },
    {
      date: '1989-09-08',
      value: '19.31',
    },
    {
      date: '1989-09-01',
      value: '18.77',
    },
    {
      date: '1989-08-25',
      value: '18.96',
    },
    {
      date: '1989-08-18',
      value: '18.77',
    },
    {
      date: '1989-08-11',
      value: '18.25',
    },
    {
      date: '1989-08-04',
      value: '18.15',
    },
    {
      date: '1989-07-28',
      value: '18.34',
    },
    {
      date: '1989-07-21',
      value: '20.06',
    },
    {
      date: '1989-07-14',
      value: '20.42',
    },
    {
      date: '1989-07-07',
      value: '20.59',
    },
    {
      date: '1989-06-30',
      value: '20.25',
    },
    {
      date: '1989-06-23',
      value: '19.95',
    },
    {
      date: '1989-06-16',
      value: '19.94',
    },
    {
      date: '1989-06-09',
      value: '20.08',
    },
    {
      date: '1989-06-02',
      value: '19.89',
    },
    {
      date: '1989-05-26',
      value: '20.28',
    },
    {
      date: '1989-05-19',
      value: '20.42',
    },
    {
      date: '1989-05-12',
      value: '19.75',
    },
    {
      date: '1989-05-05',
      value: '20.23',
    },
    {
      date: '1989-04-28',
      value: '20.87',
    },
    {
      date: '1989-04-21',
      value: '22.73',
    },
    {
      date: '1989-04-14',
      value: '20.56',
    },
    {
      date: '1989-04-07',
      value: '20.11',
    },
    {
      date: '1989-03-31',
      value: '20.40',
    },
    {
      date: '1989-03-24',
      value: '20.00',
    },
    {
      date: '1989-03-17',
      value: '19.71',
    },
    {
      date: '1989-03-10',
      value: '18.50',
    },
    {
      date: '1989-03-03',
      value: '18.40',
    },
    {
      date: '1989-02-24',
      value: '18.46',
    },
    {
      date: '1989-02-17',
      value: '18.08',
    },
    {
      date: '1989-02-10',
      value: '17.39',
    },
    {
      date: '1989-02-03',
      value: '17.41',
    },
    {
      date: '1989-01-27',
      value: '17.85',
    },
    {
      date: '1989-01-20',
      value: '19.05',
    },
    {
      date: '1989-01-13',
      value: '18.06',
    },
    {
      date: '1989-01-06',
      value: '17.35',
    },
    {
      date: '1988-12-30',
      value: '16.99',
    },
    {
      date: '1988-12-23',
      value: '17.04',
    },
    {
      date: '1988-12-16',
      value: '16.31',
    },
    {
      date: '1988-12-09',
      value: '15.61',
    },
    {
      date: '1988-12-02',
      value: '15.33',
    },
    {
      date: '1988-11-25',
      value: '14.43',
    },
    {
      date: '1988-11-18',
      value: '13.75',
    },
    {
      date: '1988-11-11',
      value: '13.93',
    },
    {
      date: '1988-11-04',
      value: '13.75',
    },
    {
      date: '1988-10-28',
      value: '13.44',
    },
    {
      date: '1988-10-21',
      value: '14.76',
    },
    {
      date: '1988-10-14',
      value: '14.08',
    },
    {
      date: '1988-10-07',
      value: '12.85',
    },
    {
      date: '1988-09-30',
      value: '13.94',
    },
    {
      date: '1988-09-23',
      value: '14.90',
    },
    {
      date: '1988-09-16',
      value: '14.75',
    },
    {
      date: '1988-09-09',
      value: '14.40',
    },
    {
      date: '1988-09-02',
      value: '15.13',
    },
    {
      date: '1988-08-26',
      value: '15.54',
    },
    {
      date: '1988-08-19',
      value: '15.58',
    },
    {
      date: '1988-08-12',
      value: '15.67',
    },
    {
      date: '1988-08-05',
      value: '15.45',
    },
    {
      date: '1988-07-29',
      value: '16.14',
    },
    {
      date: '1988-07-22',
      value: '15.86',
    },
    {
      date: '1988-07-15',
      value: '14.64',
    },
    {
      date: '1988-07-08',
      value: '15.45',
    },
    {
      date: '1988-07-01',
      value: '15.47',
    },
    {
      date: '1988-06-24',
      value: '15.95',
    },
    {
      date: '1988-06-17',
      value: '16.58',
    },
    {
      date: '1988-06-10',
      value: '17.15',
    },
    {
      date: '1988-06-03',
      value: '17.55',
    },
    {
      date: '1988-05-27',
      value: '17.29',
    },
    {
      date: '1988-05-20',
      value: '17.53',
    },
    {
      date: '1988-05-13',
      value: '17.51',
    },
    {
      date: '1988-05-06',
      value: '17.34',
    },
    {
      date: '1988-04-29',
      value: '18.25',
    },
    {
      date: '1988-04-22',
      value: '18.16',
    },
    {
      date: '1988-04-15',
      value: '18.15',
    },
    {
      date: '1988-04-08',
      value: '16.89',
    },
    {
      date: '1988-04-01',
      value: '17.07',
    },
    {
      date: '1988-03-25',
      value: '16.58',
    },
    {
      date: '1988-03-18',
      value: '16.08',
    },
    {
      date: '1988-03-11',
      value: '15.74',
    },
    {
      date: '1988-03-04',
      value: '15.64',
    },
    {
      date: '1988-02-26',
      value: '16.33',
    },
    {
      date: '1988-02-19',
      value: '16.70',
    },
    {
      date: '1988-02-12',
      value: '17.24',
    },
    {
      date: '1988-02-05',
      value: '17.08',
    },
    {
      date: '1988-01-29',
      value: '16.92',
    },
    {
      date: '1988-01-22',
      value: '17.20',
    },
    {
      date: '1988-01-15',
      value: '16.79',
    },
    {
      date: '1988-01-08',
      value: '17.60',
    },
    {
      date: '1988-01-01',
      value: '16.78',
    },
    {
      date: '1987-12-25',
      value: '16.23',
    },
    {
      date: '1987-12-18',
      value: '16.35',
    },
    {
      date: '1987-12-11',
      value: '18.34',
    },
    {
      date: '1987-12-04',
      value: '18.62',
    },
    {
      date: '1987-11-27',
      value: '18.83',
    },
    {
      date: '1987-11-20',
      value: '18.60',
    },
    {
      date: '1987-11-13',
      value: '18.88',
    },
    {
      date: '1987-11-06',
      value: '19.17',
    },
    {
      date: '1987-10-30',
      value: '20.03',
    },
    {
      date: '1987-10-23',
      value: '19.98',
    },
    {
      date: '1987-10-16',
      value: '19.82',
    },
    {
      date: '1987-10-09',
      value: '19.65',
    },
    {
      date: '1987-10-02',
      value: '19.64',
    },
    {
      date: '1987-09-25',
      value: '19.57',
    },
    {
      date: '1987-09-18',
      value: '19.63',
    },
    {
      date: '1987-09-11',
      value: '19.38',
    },
    {
      date: '1987-09-04',
      value: '19.56',
    },
    {
      date: '1987-08-28',
      value: '19.42',
    },
    {
      date: '1987-08-21',
      value: '19.61',
    },
    {
      date: '1987-08-14',
      value: '20.80',
    },
    {
      date: '1987-08-07',
      value: '21.52',
    },
    {
      date: '1987-07-31',
      value: '21.25',
    },
    {
      date: '1987-07-24',
      value: '21.50',
    },
    {
      date: '1987-07-17',
      value: '22.03',
    },
    {
      date: '1987-07-10',
      value: '21.06',
    },
    {
      date: '1987-07-03',
      value: '20.46',
    },
    {
      date: '1987-06-26',
      value: '20.21',
    },
    {
      date: '1987-06-19',
      value: '20.38',
    },
    {
      date: '1987-06-12',
      value: '19.88',
    },
    {
      date: '1987-06-05',
      value: '19.73',
    },
    {
      date: '1987-05-29',
      value: '19.34',
    },
    {
      date: '1987-05-22',
      value: '19.85',
    },
    {
      date: '1987-05-15',
      value: '19.52',
    },
    {
      date: '1987-05-08',
      value: '19.14',
    },
    {
      date: '1987-05-01',
      value: '18.76',
    },
    {
      date: '1987-04-24',
      value: '18.94',
    },
    {
      date: '1987-04-17',
      value: '18.30',
    },
    {
      date: '1987-04-10',
      value: '18.60',
    },
    {
      date: '1987-04-03',
      value: '18.77',
    },
    {
      date: '1987-03-27',
      value: '18.59',
    },
    {
      date: '1987-03-20',
      value: '18.72',
    },
    {
      date: '1987-03-13',
      value: '18.31',
    },
    {
      date: '1987-03-06',
      value: '17.47',
    },
    {
      date: '1987-02-27',
      value: '16.75',
    },
    {
      date: '1987-02-20',
      value: '17.63',
    },
    {
      date: '1987-02-13',
      value: '18.14',
    },
    {
      date: '1987-02-06',
      value: '18.45',
    },
    {
      date: '1987-01-30',
      value: '18.62',
    },
    {
      date: '1987-01-23',
      value: '18.68',
    },
    {
      date: '1987-01-16',
      value: '19.04',
    },
    {
      date: '1987-01-09',
      value: '18.38',
    },
    {
      date: '1987-01-02',
      value: '17.86',
    },
    {
      date: '1986-12-26',
      value: '17.05',
    },
    {
      date: '1986-12-19',
      value: '16.23',
    },
    {
      date: '1986-12-12',
      value: '15.34',
    },
    {
      date: '1986-12-05',
      value: '15.20',
    },
    {
      date: '1986-11-28',
      value: '15.01',
    },
    {
      date: '1986-11-21',
      value: '15.40',
    },
    {
      date: '1986-11-14',
      value: '15.45',
    },
    {
      date: '1986-11-07',
      value: '14.98',
    },
    {
      date: '1986-10-31',
      value: '14.53',
    },
    {
      date: '1986-10-24',
      value: '15.01',
    },
    {
      date: '1986-10-17',
      value: '14.69',
    },
    {
      date: '1986-10-10',
      value: '15.16',
    },
    {
      date: '1986-10-03',
      value: '15.02',
    },
    {
      date: '1986-09-26',
      value: '14.30',
    },
    {
      date: '1986-09-19',
      value: '14.23',
    },
    {
      date: '1986-09-12',
      value: '15.13',
    },
    {
      date: '1986-09-05',
      value: '16.07',
    },
    {
      date: '1986-08-29',
      value: '15.77',
    },
    {
      date: '1986-08-22',
      value: '15.30',
    },
    {
      date: '1986-08-15',
      value: '15.39',
    },
    {
      date: '1986-08-08',
      value: '14.63',
    },
    {
      date: '1986-08-01',
      value: '11.45',
    },
    {
      date: '1986-07-25',
      value: '11.31',
    },
    {
      date: '1986-07-18',
      value: '12.17',
    },
    {
      date: '1986-07-11',
      value: '11.13',
    },
    {
      date: '1986-07-04',
      value: '12.23',
    },
    {
      date: '1986-06-27',
      value: '13.56',
    },
    {
      date: '1986-06-20',
      value: '13.82',
    },
    {
      date: '1986-06-13',
      value: '13.21',
    },
    {
      date: '1986-06-06',
      value: '13.25',
    },
    {
      date: '1986-05-30',
      value: '14.64',
    },
    {
      date: '1986-05-23',
      value: '16.37',
    },
    {
      date: '1986-05-16',
      value: '15.74',
    },
    {
      date: '1986-05-09',
      value: '15.08',
    },
    {
      date: '1986-05-02',
      value: '13.76',
    },
    {
      date: '1986-04-25',
      value: '13.44',
    },
    {
      date: '1986-04-18',
      value: '12.16',
    },
    {
      date: '1986-04-11',
      value: '13.46',
    },
    {
      date: '1986-04-04',
      value: '11.44',
    },
    {
      date: '1986-03-28',
      value: '12.00',
    },
    {
      date: '1986-03-21',
      value: '13.45',
    },
    {
      date: '1986-03-14',
      value: '13.07',
    },
    {
      date: '1986-03-07',
      value: '12.27',
    },
    {
      date: '1986-02-28',
      value: '14.25',
    },
    {
      date: '1986-02-21',
      value: '14.39',
    },
    {
      date: '1986-02-14',
      value: '16.25',
    },
    {
      date: '1986-02-07',
      value: '16.72',
    },
    {
      date: '1986-01-31',
      value: '19.69',
    },
    {
      date: '1986-01-24',
      value: '20.31',
    },
    {
      date: '1986-01-17',
      value: '24.57',
    },
    {
      date: '1986-01-10',
      value: '25.99',
    },
    {
      date: '1986-01-03',
      value: '25.78',
    },
  ],
};
