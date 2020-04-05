'use strict';
const xml2Js = require('xml2js').parseString;
const jsonToXml = require('jsontoxml');
const async = require('async');
const RecursiveIterator = require('recursive-iterator');
const fs = require('fs')

const config = {
  s3Bucket: process.env.S3_BUCKET || 'hc-apps',
  routeColour: process.env.ROUTE_COLOUR || 'ff419076',
  routeWidth: process.env.ROUTE_WIDTH || 4
};

const jsonToXmlOpts = {
  xmlHeader: { standalone: true }
};

const gpx = fs.readFileSync('./ct364_route4web_stages.gpx')

const GPXtoKMLParts = (body, cb) => {
  xml2Js(body.toString(), (err, result) => {
    let routes = [];
    let tracks = [];

    if (result.gpx.hasOwnProperty('rte')) {
      routes = routes.concat(result.gpx.rte);
    }

    if (result.gpx.hasOwnProperty('trk')) {
      routes = routes.concat(result.gpx.trk);
    }

    async.forEach(routes, (route, cb) => {
      let coords = '';

      const iterator = new RecursiveIterator(route);
      for (let item = iterator.next(); !item.done; item = iterator.next()) {
        if (item.value.node.hasOwnProperty('lon') && item.value.node.hasOwnProperty('lat')) {
          coords += parseFloat(item.value.node.lon).toFixed(9) + ',' + parseFloat(item.value.node.lat).toFixed(9) + ' ';
        }
      }

      console.info('Adding coordinates for: ', route.name);

      tracks.push([{
        name: 'kml',
        attrs: {
          xmlns: 'http://www.opengis.net/kml/2.2'
        },
        children: [{
          name: 'Document',
          children: [{
            visibility: 1,
            open: 1
          }, {
            name: 'Style',
            attrs: {
              id: 'track'
            },
            children: {
              LineStyle: {
                color: config.routeColour,
                width: config.routeWidth
              }
            }
          }, {
            name: 'Folder',
            attrs: {
              id: 'Tracks'
            },
            children: [{
              name: 'name',
              text: 'Tracks'
            }, {
              name: 'visibility',
              text: 1
            }, {
              name: 'open',
              text: 0
            }, [{
              name: 'Placemark',
              children: {
                name: '<![CDATA[' + route.name + ']]>',
                styleUrl: '#track',
                MultiGeometry: {
                  LineString: {
                    tessellate: 1,
                    altitudeMode: 'clampToGround',
                    coordinates: coords
                  }
                }
              }
            }]]
          }]
        }]
      }]);

      cb();
    }, (err) => {
      if (err) { cb(err); }

      cb(null, tracks);
    });
  });
};

const GPXtoKML = (body, cb) => {
  xml2Js(body.toString(), (err, result) => {
    let routes = [];
    let tracks = [];

    if (result.gpx.hasOwnProperty('rte')) {
      routes = routes.concat(result.gpx.rte);
    }

    if (result.gpx.hasOwnProperty('trk')) {
      routes = routes.concat(result.gpx.trk);
    }

    async.forEach(routes, (route, cb) => {
      let coords = '';

      const iterator = new RecursiveIterator(route);
      for (let item = iterator.next(); !item.done; item = iterator.next()) {
        if (item.value.node.hasOwnProperty('lon') && item.value.node.hasOwnProperty('lat')) {
          coords += parseFloat(item.value.node.lon).toFixed(9) + ',' + parseFloat(item.value.node.lat).toFixed(9) + ' ';
        }
      }

      console.info('Adding coordinates for: ', route.name);

      tracks.push({
        name: 'Placemark',
        children: {
          name: '<![CDATA[' + route.name + ']]>',
          styleUrl: '#track',
          MultiGeometry: {
            LineString: {
              tessellate: 1,
              altitudeMode: 'clampToGround',
              coordinates: coords
            }
          }
        }
      });

      cb();
    }, (err) => {
      if (err) { cb(err); }

      let template = [{
        name: 'kml',
        attrs: {
          xmlns: 'http://www.opengis.net/kml/2.2'
        },
        children: [{
          name: 'Document',
          children: [{
            visibility: 1,
            open: 1
          }, {
            name: 'Style',
            attrs: {
              id: 'track'
            },
            children: {
              LineStyle: {
                color: config.routeColour,
                width: config.routeWidth
              }
            }
          }, {
            name: 'Folder',
            attrs: {
              id: 'Tracks'
            },
            children: [{
              name: 'name',
              text: 'Tracks'
            }, {
              name: 'visibility',
              text: 1
            }, {
              name: 'open',
              text: 0
            }, tracks ]
          }]
        }]
      }];

      cb(null, jsonToXml(template, jsonToXmlOpts));
    });
  });
};

GPXtoKML(gpx, (err, kml) => {
  if (err) return console.log(err)

  const data = new Uint8Array(Buffer.from(kml))
  fs.writeFile('kml.kml', data, (err) => {
    if (err) return console.log(err)
    console.log('file saved')
  })
})

GPXtoKMLParts(gpx, (err, kmlParts) => {
  if (err) return console.log(err)

  for (let i = 0; i < kmlParts.length; i++) {
    const data = new Uint8Array(Buffer.from(jsonToXml(kmlParts[i], jsonToXmlOpts)))

    fs.writeFile(`kmlPart-${i}.kml`, data, (err) => {
      if (err) return console.log(err)
      console.log('file saved')
    })
  }
})
