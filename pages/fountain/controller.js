import riot from 'riot';
import template from './template.html!text';

export default function(sandbox) {
  return {
    init: function() {
      riot.route('/unity-fountain', function() {
        var eventName = 'unity-layout.page-content.onBuildContent';
        sandbox.get('bus').emit(eventName, template, function(opts) {
          controller.call(this, sandbox, opts);
        });
      });
    }
  };
}

function controller(sandbox, opts) {
  var riot = sandbox.get('lib').riot;

  this.getData = function() {
    return {
      fountain: this['unity-fountain-fountainId'].value,
      message: this['unity-fountain-message'].value
    };
  };

  this.on('mount', function() {
    componentHandler.upgradeElements(this.root.childNodes);
  });

  this.data = {
    fountain: '17012a5878f87a4ad611b53e4d79acc7',
    amount: 0,
    message: ''
  };

  this.doSet = function() {
    let gen1 =
      `
  <unity-fountain 
    fountain="{fountain}"
    message="{message}">
  </unity-fountain>
  `;
    let gen2 =
      `
<div fountain="{fountain}"
          message="{message}"
          data-is="unity-fountain"
          riot-tag="unity-fountain">
</div>
`;

    var data = this.getData();
    this.codeGenerate1 = riot.util.tmpl(gen1, data);
    this.codeGenerate2 = riot.util.tmpl(gen2, data);

    var uftag = this.tags['unity-fountain'];
    uftag.changeOpts(data);
    this.update({
      data: data
    });
    componentHandler.upgradeElements(this.root.childNodes);
  };
}