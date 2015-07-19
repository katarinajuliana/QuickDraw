angular.module('performanceApp', [])
  .controller('SitesCtrl', function($scope, $rootScope, $http, $q, Site) {
    $scope.sites = Site.sites;
    
    $scope.runTests = function() {
      var requests = [];
      
      $scope.sites = $scope.sites.filter(function(site) {
        return site.URL.length;
      });
      
      angular.forEach($scope.sites, function(site, index) {
        var deferred = $q.defer();
        
        $http.get('http://www.webpagetest.org/runtest.php?f=json&k=A.950ee6c484b020876b5877b5195ea1bf&url=' + site.URL)
        .success(function(data) {
          if (data.statusCode === 400) {
            // WebPageTest couldn't fetch the url
            $scope.sites.splice(index, 1);
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
  .controller('ResultsCtrl', function($scope, $rootScope, $timeout, $http) {    
    var resultURLBase = 'http://www.webpagetest.org/jsonResult.php?test=',
        metrics = {
          'loadTime': { results: [], max: 0 },
          'TTFB': { results: [], max: 0 },
          'speedIndex': { results: [], max: 0 },
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
        metricMap = {
          'visuallyComplete': 'visualComplete',
          'domContentLoaded': 'domContentLoadedEventStart',
          'domComplete': 'loadEventStart',
          'images': 'image_total'
        },
        colors = [
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
        ];
    
    $scope.uncachedResults = angular.copy(metrics);
    $scope.cachedResults = angular.copy(metrics);
    
    $scope.fetchResults = function() {
      var fetchResult = function(resultID) {
        $http.get(resultURLBase + resultID).success(function(data) {
          if (data.statusCode === 200) {
            $scope.updateStats(data.data.runs[1]);
          }
          else {
            $timeout(fetchResult(resultID), 5000);
          }
        });
      };
      
      angular.forEach($scope.resultIDs, function(resultID) {
        fetchResult(resultID);
      });
    };
    
    $scope.updateStats = function(data) {           
      var url = data['firstView']['URL'],
          color = colors.shift();
      
      angular.forEach(metrics, function(object, metric) {
        var value = metric == 'requests' ? data['firstView'][metric].length : data['firstView'][metricMap[metric] || metric];
        $scope.uncachedResults[metric]['results'].push({ 
          url: url,
          value: value,
          color: color
        });
        
        if ($scope.uncachedResults[metric].max < value) {
          $scope.uncachedResults[metric].max = value;
        }
        
        value = metric == 'requests' ? data['repeatView'][metric].length : data['repeatView'][metricMap[metric] || metric];
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
      $scope.resultIDs = /results=(.*)/.exec(window.location.search)[1].split(',');
      
      $rootScope.showResults = true;
      $scope.fetchResults();
    }
    
    $scope.$on('showResults', function(e) {
      var newURL;
      
      $scope.resultIDs = $scope.sites.map(function(site) {
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
      }
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