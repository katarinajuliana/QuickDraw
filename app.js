angular.module('performanceApp', [])
  .controller('SitesCtrl', function($scope, $rootScope, $http, $q, Site) {
    $scope.sites = Site.sites;
    $scope.errors = [];
    $scope.mobile = 0;
    
    $scope.runSiteTests = function() {
      var requests = [];
      
      $scope.sites = $scope.sites.filter(function(site) {
        return site.URL.length;
      });
      
      angular.forEach($scope.sites, function(site, index) {
        var deferred = $q.defer();
        
        $http.get(Site.testURLBase + site.URL + '&mobile=' + $scope.mobile).success(function(data) {
          if (data.statusCode === 400) {
            // WebPageTest couldn't fetch the url
            $scope.errors.push(site.URL);
          } else {
            $scope.sites[index]['resultID'] = data.data.testId;
          }
          
          deferred.resolve();
        }).error(function() { deffered.resolve(); });
        
        requests.push(deferred.promise);
      });

      $q.all(requests).then(function() {
        $rootScope.$broadcast('showResults'); 
      });
    };
    
    $scope.$on('sites.update', function(e) {
      $scope.sites = Site.sites;
      $scope.$apply();
    });
  })
  .controller('ResultsCtrl', function($scope, $rootScope, $timeout, $http, Result) {
    $scope.uncachedResults = angular.copy(Result.metrics);
    $scope.cachedResults = angular.copy(Result.metrics);
    $scope.waitingFor = [];
    
    $scope.fetchResults = function() {
      var fetchResult = function(resultID) {
        $http.get(Result.URLBase + resultID).success(function(data) {
          if (data.statusCode === 200) {
            $scope.updateStats(data.data.runs[1]);
            $scope.waitingFor.splice($scope.waitingFor.indexOf(data.data.url), 1);
          }
          else {
            $timeout(fetchResult(resultID), 3000);
            if ($scope.waitingFor.indexOf(data.data.testInfo.url) < 0) {
              $scope.waitingFor.push(data.data.testInfo.url);
            }
          }
        });
      };
      
      angular.forEach($scope.resultIDs, function(resultID) {
        fetchResult(resultID);
      });
    };
    
    $scope.updateStats = function(data) {           
      var url = data['firstView']['URL'],
          color = Result.colors.shift();
      
      angular.forEach(Result.metrics, function(object, metric) {
        var value = metric == 'requests' ? data['firstView'][metric].length : data['firstView'][Result.metricMap[metric] || metric];
        $scope.uncachedResults[metric]['results'].push({ 
          url: url,
          value: value,
          color: color
        });
        
        if ($scope.uncachedResults[metric].max < value) {
          $scope.uncachedResults[metric].max = value;
        }
        
        value = metric == 'requests' ? data['repeatView'][metric].length : data['repeatView'][Result.metricMap[metric] || metric];
        $scope.cachedResults[metric]['results'].push({
          url: url,
          value: value,
          color: color
        });
        
        if ($scope.cachedResults[metric].max < value) {
          $scope.cachedResults[metric].max = value;
        }
      });
    };
    
    if (/results/.test(window.location.search)) {
      var resultIDs = /results=(.*)/.exec(window.location.search)[1].split(',');
      $scope.resultIDs = resultIDs.filter(function(resultID) {
        return resultID.length;
      });
      
      $rootScope.showResults = true;
      $scope.fetchResults();
    }
    
    $scope.$on('showResults', function(e) {
      var newURL;
      
      $scope.resultIDs = $scope.sites.filter(function(site) {
        return site.resultID;
      }).map(function(site) {
        return site.resultID;
      });
      
      newURL = window.location.href + '?results=' + $scope.resultIDs.join(',');
      window.history.pushState(null, '', newURL);
      
      $rootScope.showResults = true;
      $scope.fetchResults();
    });
  })
  .service('Site', function($rootScope) {
    var siteTemplate = { URL: '' };
    
    var service = {
      sites: [
        { URL: '' ,  mine: true },
        angular.copy(siteTemplate)
      ],
      
      addCompetitor: function() {
        service.sites.push(angular.copy(siteTemplate));
        $rootScope.$broadcast('sites.update');
      },
      testURLBase: 'http://www.webpagetest.org/runtest.php?f=json&k=A.950ee6c484b020876b5877b5195ea1bf&url='
    }

    return service;
  })
  .service('Result', function() {
    var service = {
      URLBase: 'http://www.webpagetest.org/jsonResult.php?test=',
      metrics: {
        'loadTime': { results: [], max: 0 },
        'TTFB': { results: [], max: 0 },
        'SpeedIndex': { results: [], max: 0 },
        'firstPaint': { results: [], max: 0 },
        'render': { results: [], max: 0 },
        'visuallyComplete': { results: [], max: 0 },
        'domContentLoaded': { results: [], max: 0 },
        'domComplete': { results: [], max: 0 },
        'fullyLoaded': { results: [], max: 0 },
        'requests': { results: [], max: 0 },
        'images': { results: [], max: 0 },
        'domElements': { results: [], max: 0 }
      },
      metricMap: {
        'visuallyComplete': 'visualComplete',
        'domContentLoaded': 'domContentLoadedEventStart',
        'domComplete': 'loadEventStart',
        'images': 'image_total'
      },
      colors: [
        'teal',
        'rosybrown',
        'darksalmon',
        'burlywood',
        'indianred',
        'thistle',
        'dimgrey',
        'steelblue',
        'mediumturquoise',
        'darkblue'
      ]
    }

    return service;
  })
  .directive('newCompetitorButton', function(Site) {
    return {
      restrict: 'A',
      link: function(scope, element, attrs) {
        element.bind('click', function() {
          Site.addCompetitor();
        })
      }
    }
  });