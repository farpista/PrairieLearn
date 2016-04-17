var Promise = require('bluebird');
var models = require('../models');
var config = require('../config');
var _ = require('underscore');
var csvStringify = require('csv').stringify;

var express = require('express');
var router = express.Router();

var csvFilename = function(locals) {
    return locals.course.short_name.replace(/\s+/g, '')
        + '_'
        + locals.semester.short_name
        + '_'
        + 'test_stats.csv';
};

var sql
    = ' SELECT'
    + '     t.*,'
    + '     t.number as test_number,'
    + '     tstats.number,tstats.mean,tstats.std,tstats.min,tstats.max,'
    + '     tstats.median,tstats.n_zero,tstats.n_hundred,'
    + '     tstats.n_zero_perc,n_hundred_perc,tstats.score_hist,'
    + '     dstats.mean AS mean_duration,format_interval(dstats.median) AS median_duration,'
    + '     dstats.min AS min_duration,dstats.max AS max_duration,'
    + '     ts.short_name,ts.long_name,ts.color,'
    + '     (ts.short_name || t.number) as label,'
    + '     (lag(ts.id) OVER (PARTITION BY ts.id ORDER BY t.number, t.id) IS NULL) AS start_new_set'
    + ' FROM tests AS t'
    + ' LEFT JOIN test_sets AS ts ON (ts.id = t.test_set_id)'
    + ' LEFT JOIN test_stats AS tstats ON (tstats.id = t.id)'
    + ' LEFT JOIN test_duration_stats AS dstats ON (dstats.id = t.id)'
    + ' WHERE t.course_instance_id = $courseInstanceId'
    + ' AND t.deleted_at IS NULL'
    + ' ORDER BY (ts.number, t.number, t.id)'
    + ' ;';

router.get('/', function(req, res, next) {
    Promise.try(function() {
        var params = {
            courseInstanceId: req.locals.courseInstanceId,
        };
        return models.sequelize.query(sql, {bind: params});
    }).spread(function(results, info) {
        var locals = _.extend({
            results: results,
            csvFilename: csvFilename(req.locals),
        }, req.locals);
        res.render('pages/tests', locals);
    });
});

router.get('/:filename', function(req, res, next) {
    if (req.params.filename == csvFilename(req.locals)) {
        Promise.try(function() {
            var params = {
                courseInstanceId: req.locals.courseInstanceId,
            };
            return models.sequelize.query(sql, {bind: params});
        }).spread(function(testStats, info) {
            var csvHeaders = ['Course', 'Semester', 'Set', 'Number', 'Test', 'Title', 'TID',
                              'NStudents', 'Mean', 'Std', 'Min', 'Max', 'Median',
                              'NZero', 'NHundred', 'NZeroPerc', 'NHundredPerc',
                              'Hist1', 'Hist2', 'Hist3', 'Hist4', 'Hist5',
                              'Hist6', 'Hist7', 'Hist8', 'Hist9', 'Hist10'];
            var csvData = [];
            _(testStats).each(function(testStat) {
                var csvRow = [
                    req.locals.course.short_name,
                    req.locals.semester.short_name,
                    testStat.long_name,
                    testStat.test_number,
                    testStat.label,
                    testStat.title,
                    testStat.tid,
                    testStat.number,
                    testStat.mean,
                    testStat.std,
                    testStat.min,
                    testStat.max,
                    testStat.median,
                    testStat.n_zero,
                    testStat.n_hundred,
                    testStat.n_zero_perc,
                    testStat.n_hundred_perc,
                ];
                csvRow = csvRow.concat(testStat.score_hist);
                csvData.push(csvRow);
            });
            csvData.splice(0, 0, csvHeaders);
            csvStringify(csvData, function(err, csv) {
                if (err) throw Error("Error formatting CSV", err);
                res.attachment(req.params.filename);
                res.send(csv);
            });
        });
    } else {
        throw Error("Unknown filename: " + req.params.filename);
    }
});

module.exports = router;
