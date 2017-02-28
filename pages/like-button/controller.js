import riot from 'riot';
import template from './template.html!text';

export default function(sandbox) {
  return {
    init: function() {
      function handler() {
        var eventName = 'unity-layout.page-content.onBuildContent';
        sandbox.get('bus').emit(eventName, template, function(opts) {
          controller.call(this, sandbox, opts);
        });
      };

      riot.route('/unity-like-button', handler);
      riot.route('', handler);
    }
  };
}

function controller(sandbox, opts) {
  var riot = sandbox.get('lib').riot;

  this.data = {
    height: 36,
    publicAddress: 'UNGdwWxU43EARgnEjgjTeZZbZgLxUyR7bC',
    amount: 10,
    message: '',
    caption: 'Like',
    paddingLeft: 10,
    paddingRight: 10
  };

  this.getData = function() {
    var paddingLeft = parseFloat(this['unity-like-padding-left'].value) || 10;
    var paddingRight = parseFloat(this['unity-like-padding-right'].value) ||
      10;
    var address = this['unity-like-address'].value || '1234567890';

    return {
      height: parseFloat(this['unity-like-height'].value) || 36,
      publicAddress: address,
      amount: parseFloat(this['unity-like-amount'].value) || '10',
      message: this['unity-like-message'].value,
      caption: this['unity-like-caption'].value || 'UNITY',
      paddingLeft: paddingLeft,
      paddingRight: paddingRight
    };
  };

  this.doSet = function() {
    let gen1 =
      `
  <unity-like amount="{amount}"
              public-address="{publicAddress}"
              message="{message}"
              caption="{caption}"
              height="{height}"
              padding-left="{paddingLeft}"
              padding-right="{paddingRight}">
  </unity-like>
  `;
    let gen2 =
      `
<div amount="{amount}"
            public-address="{publicAddress}"
            message="{message}"
            caption="{caption}"
            height="{height}"
            padding-left="{paddingLeft}"
            padding-right="{paddingRight}"
            riot-tag="unity-like"
            data-is="unity-like">
</div>
`;

    var data = this.getData();
    this.codeGenerate1 = riot.util.tmpl(gen1, data);
    this.codeGenerate2 = riot.util.tmpl(gen2, data);

    var ultag = this.tags['unity-like'];
    ultag.changeOpts(data);
    this.data = data;
  };
}
