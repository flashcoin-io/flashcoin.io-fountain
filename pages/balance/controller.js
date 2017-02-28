import riot from 'riot';
import template from './template.html!text';

export default function(sandbox) {
  return {
    init: function() {
      riot.route('/unity-balance', function() {
        var eventName = 'unity-layout.page-content.onBuildContent';
        sandbox.get('bus').emit(eventName, template, function(opts) {
          this.codeGenerate1 = '<unity-balance></unity-balance>';
          this.codeGenerate2 =
            '<div riot-tag="unity-balance" data-is="unity-balance"></div>';
        });
      });
    }
  };
}
